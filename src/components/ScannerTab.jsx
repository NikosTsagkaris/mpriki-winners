import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, runTransaction, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function ScannerTab() {
  const [scanResult, setScanResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const scannerRef = useRef(null);
  const processedTokensRef = useRef(new Set());
  const fileInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        if (!document.getElementById('reader')) return;
        const html5QrCode = new Html5Qrcode('reader');
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (isMounted) {
              handleQrDetected(decodedText);
            }
          },
          () => {
            // ignore scan frame errors
          }
        );
      } catch (err) {
        console.warn('Camera start error:', err);
        if (isMounted) {
          setCameraError(
            'Απαιτείται άδεια πρόσβασης στην κάμερα για το σκανάρισμα QR codes. Βεβαιωθείτε ότι επιτρέψατε την πρόσβαση στις ρυθμίσεις.'
          );
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .then(() => scannerRef.current?.clear())
          .catch((err) => console.warn('Error stopping scanner:', err));
      }
    };
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const fileScanner = new Html5Qrcode('file-reader');
      const decodedResult = await fileScanner.scanFileV2(file, true);
      if (decodedResult?.decodedText) {
        handleQrDetected(decodedResult.decodedText);
      } else {
        alert('Δεν βρέθηκε QR code στη φωτογραφία. Παρακαλώ ανεβάστε μια καθαρή φωτογραφία του QR code.');
      }
    } catch (err) {
      console.error('File scan error:', err);
      alert('Δεν βρέθηκε QR code στη φωτογραφία. Παρακαλώ ανεβάστε μια καθαρή φωτογραφία του QR code.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const recordWeeklyWinner = async (prizeName) => {
    try {
      const user = auth.currentUser;
      const username = user?.displayName || user?.email?.split('@')[0] || 'Νικητής';
      const maskedUsername = username.length <= 3 ? `${username[0]}***` : `${username[0]}***${username[username.length - 1]}`;
      await setDoc(doc(db, 'weekly_winners', `w_${Date.now()}`), {
        username: username,
        maskedUsername: maskedUsername,
        prizeWon: prizeName,
        timestampMillis: Date.now()
      });
    } catch (err) {
      console.error('Error recording weekly winner:', err);
    }
  };

  const addPrizeToHistory = async (transaction, userRef, userDoc, prizeName) => {
    try {
      const existingHistory = userDoc.exists() ? userDoc.data().prizeHistory || [] : [];
      const newPrize = {
        id: `prize_${Date.now()}`,
        prizeName: prizeName,
        dateWonFormatted: new Date().toLocaleDateString('el-GR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        isRedeemed: false
      };
      transaction.set(userRef, { prizeHistory: [newPrize, ...existingHistory] }, { merge: true });
    } catch (err) {
      console.error('Error adding prize history:', err);
    }
  };

  const handleQrDetected = async (qrText) => {
    const token = (qrText || '').trim();
    if (!token) return;

    if (processedTokensRef.current.has(token)) {
      setScanResult({
        type: 'INVALID',
        title: 'Δεν Κερδίσατε τίποτα ❌',
        reason: 'Αυτό το QR Code έχει ήδη χρησιμοποιηθεί.'
      });
      return;
    }

    // Pause scanner during processing
    if (scannerRef.current) {
      try {
        scannerRef.current.pause(true);
      } catch (e) {}
    }

    setLoading(true);
    const user = auth.currentUser;
    const uid = user ? user.uid : 'anonymous_user';
    const safeTokenKey = encodeURIComponent(token).replace(/\./g, '_');

    try {
      const qrRef = doc(db, 'qr_tokens', safeTokenKey);
      const userRef = doc(db, 'users', uid);

      const result = await runTransaction(db, async (transaction) => {
        const qrDoc = await transaction.get(qrRef);
        const userDoc = await transaction.get(userRef);

        if (qrDoc.exists()) {
          if (qrDoc.data().redeemed) {
            return {
              type: 'INVALID',
              title: 'Δεν Κερδίσατε τίποτα ❌',
              reason: 'Αυτό το QR Code έχει ήδη χρησιμοποιηθεί.'
            };
          }

          const qrType = qrDoc.data().type || 'ENTRY';
          const currentEntries = (userDoc.exists() && userDoc.data().totalMonthlyEntries) || 0;
          const currentPoints = (userDoc.exists() && userDoc.data().rewardPoints) || 0;
          const newEntries = currentEntries + 1;
          const newPoints = currentPoints + 5;

          transaction.set(userRef, { totalMonthlyEntries: newEntries, rewardPoints: newPoints }, { merge: true });
          transaction.update(qrRef, { redeemed: true, scannedBy: uid, scannedAt: Date.now() });

          if (qrType === 'COFFEE' || token.toUpperCase().includes('COFFEE')) {
            const prizeName = 'Δωρεάν Καφές';
            await recordWeeklyWinner(prizeName);
            await addPrizeToHistory(transaction, userRef, userDoc, prizeName);
            return {
              type: 'COFFEE',
              prizeName: prizeName,
              claimCode: `MPRIKI-${Math.floor(1000 + Math.random() * 9000)}`,
              instructions: 'Δείξτε αυτόν τον κωδικό στο ταμείο για να λάβετε 1 Δωρεάν Καφέ! (Κερδίσατε +1 Συμμετοχή & +5 Πόντους!)',
              totalActiveEntries: newEntries
            };
          } else {
            return {
              type: 'ENTRY',
              totalActiveEntries: newEntries,
              message: '1 Συμμετοχή στην κλήρωση & +5 Πόντοι Επιβράβευσης καταχωρήθηκαν επιτυχώς!'
            };
          }
        } else {
          // Token generated directly from POS receipt
          const isCoffee = token.toUpperCase().includes('COFFEE') || token.includes('1+1');
          const qrType = isCoffee ? 'COFFEE' : 'ENTRY';
          const currentEntries = (userDoc.exists() && userDoc.data().totalMonthlyEntries) || 0;
          const currentPoints = (userDoc.exists() && userDoc.data().rewardPoints) || 0;
          const newEntries = currentEntries + 1;
          const newPoints = currentPoints + 5;

          transaction.set(userRef, { totalMonthlyEntries: newEntries, rewardPoints: newPoints }, { merge: true });
          transaction.set(qrRef, { redeemed: true, scannedBy: uid, scannedAt: Date.now(), type: qrType });

          if (isCoffee) {
            const prizeName = 'Δωρεάν Καφές';
            await recordWeeklyWinner(prizeName);
            await addPrizeToHistory(transaction, userRef, userDoc, prizeName);
            return {
              type: 'COFFEE',
              prizeName: prizeName,
              claimCode: `MPRIKI-${Math.floor(1000 + Math.random() * 9000)}`,
              instructions: 'Δείξτε αυτόν τον κωδικό στο ταμείο για να λάβετε 1 Δωρεάν Καφέ! (Κερδίσατε +1 Συμμετοχή & +5 Πόντους!)',
              totalActiveEntries: newEntries
            };
          } else {
            return {
              type: 'ENTRY',
              totalActiveEntries: newEntries,
              message: '1 Συμμετοχή στην κλήρωση & +5 Πόντοι Επιβράβευσης καταχωρήθηκαν επιτυχώς!'
            };
          }
        }
      });

      processedTokensRef.current.add(token);
      setScanResult(result);
    } catch (err) {
      console.error('Scan processing error:', err);
      processedTokensRef.current.add(token);
      setScanResult({
        type: 'INVALID',
        title: 'Δεν Κερδίσατε τίποτα ❌',
        reason: 'Δεν Κερδίσατε τίποτα'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleContinueScanning = () => {
    setScanResult(null);
    if (scannerRef.current) {
      try {
        scannerRef.current.resume();
      } catch (e) {}
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-between pb-24">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />
      <div id="file-reader" className="hidden"></div>

      <div className="w-full pt-6 pb-3 text-center z-10 px-4">
        <span className="inline-block px-4 py-1.5 bg-slate-900/80 border border-slate-800 backdrop-blur text-xs font-semibold text-slate-300 rounded-full">
          Τοποθετήστε το QR Code εντός του πλαισίου
        </span>
      </div>

      <div className="relative w-full max-w-md aspect-square flex flex-col items-center justify-center p-4">
        {cameraError ? (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center">
            <div className="text-4xl mb-3">📷</div>
            <p className="text-sm font-semibold text-rose-400 mb-2">{cameraError}</p>
            <p className="text-xs text-slate-400">Μπορείτε εναλλακτικά να ανεβάσετε φωτογραφία του QR code:</p>
          </div>
        ) : (
          <div className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-amber-500/50 shadow-2xl bg-black">
            <div id="reader" className="w-full h-full object-cover"></div>
          </div>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 w-full py-3 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/50 text-slate-200 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg transition"
        >
          <span className="text-base">📁</span>
          <span>Επιλογή Φωτογραφίας (QR Code)</span>
        </button>
      </div>

      {loading && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-xs shadow-2xl">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="font-bold text-white text-lg">Επαλήθευση QR Code...</h3>
            <p className="text-xs text-slate-400 mt-1">Έλεγχος επιβράβευσης στο Firebase</p>
          </div>
        </div>
      )}

      {scanResult && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {scanResult.type === 'COFFEE' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/30 text-3xl">
                  🎉
                </div>
                <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide">🎉 ΑΜΕΣΟΣ ΝΙΚΗΤΗΣ!</h2>
                <h3 className="text-2xl font-extrabold text-white mt-1">{scanResult.prizeName}</h3>
                <div className="my-6 p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">ΚΩΔΙΚΟΣ ΕΞΑΡΓΥΡΩΣΗΣ</p>
                  <p className="text-3xl font-black text-amber-400 tracking-widest mt-1">{scanResult.claimCode}</p>
                </div>
                <p className="text-xs text-slate-400">{scanResult.instructions}</p>
              </div>
            )}

            {scanResult.type === 'ENTRY' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/30 text-3xl">
                  🎟️
                </div>
                <h2 className="text-xl font-extrabold text-white">1 Συμμετοχή στην κλήρωση! 🎟️</h2>
                <p className="text-xs text-slate-400 mt-2">{scanResult.message}</p>
                <div className="my-6 p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between">
                  <span className="text-sm text-slate-300 font-medium">Συνολικές Ενεργές Συμμετοχές:</span>
                  <span className="px-3 py-1 bg-amber-500 text-slate-950 font-black text-lg rounded-full">
                    {scanResult.totalActiveEntries}
                  </span>
                </div>
              </div>
            )}

            {scanResult.type === 'INVALID' && (
              <div className="text-center">
                <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-500/30 text-3xl">
                  ❌
                </div>
                <h2 className="text-xl font-extrabold text-rose-400">{scanResult.title}</h2>
                <p className="text-xs text-slate-400 mt-2">{scanResult.reason}</p>
              </div>
            )}

            <button
              onClick={handleContinueScanning}
              className="w-full mt-6 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl transition"
            >
              Συνέχεια Σκαναρίσματος
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

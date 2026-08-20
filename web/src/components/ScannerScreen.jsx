import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { doc, runTransaction, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function ScannerScreen() {
  const [scanResult, setScanResult] = useState(null);
  const [validating, setValidating] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const html5QrcodeScanner = useRef(null);
  const sessionCache = useRef(new Set());

  useEffect(() => {
    let isMounted = true;

    const startScanner = async () => {
      try {
        if (!document.getElementById('reader')) return;
        const html5Qrcode = new Html5Qrcode("reader");
        html5QrcodeScanner.current = html5Qrcode;

        await html5Qrcode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText) => {
            if (isMounted) {
              handleQrCodeScanned(decodedText);
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Camera error:", err);
        if (isMounted) {
          setCameraError("Απαιτείται άδεια πρόσβασης στην κάμερα για το σκανάρισμα QR codes.");
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      if (html5QrcodeScanner.current) {
        try {
          if (html5QrcodeScanner.current.isScanning) {
            html5QrcodeScanner.current.stop().catch(err => console.error("Error stopping scanner", err));
          }
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  const pauseCamera = () => {
    if (html5QrcodeScanner.current) {
      try {
        html5QrcodeScanner.current.pause(true);
      } catch (e) {
        console.error("Pause camera error:", e);
      }
    }
  };

  const resumeCamera = () => {
    if (html5QrcodeScanner.current) {
      try {
        html5QrcodeScanner.current.resume();
      } catch (e) {
        console.error("Resume camera error:", e);
      }
    }
  };

  const handleQrCodeScanned = async (qrContent) => {
    if (validating || scanResult) return;

    // Immediately pause camera to stop relentless scan triggers
    pauseCamera();

    if (sessionCache.current.has(qrContent)) {
      setScanResult({
        type: 'INVALID',
        title: 'Δεν Κερδίσατε τίποτα ❌',
        reason: 'Αυτό το QR Code έχει ήδη χρησιμοποιηθεί.'
      });
      return;
    }

    setValidating(true);
    const currentUser = auth.currentUser;
    const currentUserId = currentUser ? currentUser.uid : 'anonymous_user';
    const safeDocId = encodeURIComponent(qrContent).replace(/\./g, '_');

    try {
      const tokenRef = doc(db, 'qr_tokens', safeDocId);
      const userRef = doc(db, 'users', currentUserId);

      const result = await runTransaction(db, async (transaction) => {
        // STRICT READS FIRST
        const tokenDoc = await transaction.get(tokenRef);
        const userDoc = await transaction.get(userRef);

        if (tokenDoc.exists()) {
          const isRedeemed = tokenDoc.data().redeemed;
          if (isRedeemed) {
            return {
              type: 'INVALID',
              title: 'Δεν Κερδίσατε τίποτα ❌',
              reason: 'Αυτό το QR Code έχει ήδη χρησιμοποιηθεί.'
            };
          }

          const type = tokenDoc.data().type || 'ENTRY';
          transaction.update(tokenRef, {
            redeemed: true,
            scannedBy: currentUserId,
            scannedAt: Date.now()
          });

          if (type === 'COFFEE') {
            await recordWeeklyWinner("1+1 Καφές");
            await addPrizeToUserHistory(transaction, userRef, userDoc, "1+1 Καφές");
            return {
              type: 'COFFEE',
              prizeName: '1+1 Καφές',
              claimCode: `MPRIKI-${Math.floor(1000 + Math.random() * 9000)}`,
              instructions: 'Δείξτε αυτόν τον κωδικό στο ταμείο για να λάβετε 1+1 Δωρεάν Καφέ!'
            };
          } else if (type === 'ENTRY') {
            const currentEntries = userDoc.exists() ? (userDoc.data().totalMonthlyEntries || 0) : 0;
            const newTotal = currentEntries + 1;
            transaction.set(userRef, { totalMonthlyEntries: newTotal }, { merge: true });
            return {
              type: 'ENTRY',
              totalActiveEntries: newTotal,
              message: '1 Συμμετοχή στην κλήρωση καταχωρήθηκε επιτυχώς!'
            };
          } else {
            return {
              type: 'INVALID',
              title: 'Δεν Κερδίσατε τίποτα ❌',
              reason: 'Δεν Κερδίσατε τίποτα'
            };
          }
        } else {
          // First scan of dynamic QR string
          const detectedType = (qrContent.toUpperCase().includes('COFFEE') || qrContent.includes('1+1')) 
            ? 'COFFEE' 
            : qrContent.toUpperCase().includes('ENTRY') 
            ? 'ENTRY' 
            : 'NONE';

          transaction.set(tokenRef, {
            redeemed: true,
            scannedBy: currentUserId,
            scannedAt: Date.now(),
            type: detectedType
          });

          if (detectedType === 'COFFEE') {
            await recordWeeklyWinner("1+1 Καφές");
            await addPrizeToUserHistory(transaction, userRef, userDoc, "1+1 Καφές");
            return {
              type: 'COFFEE',
              prizeName: '1+1 Καφές',
              claimCode: `MPRIKI-${Math.floor(1000 + Math.random() * 9000)}`,
              instructions: 'Δείξτε αυτόν τον κωδικό στο ταμείο για να λάβετε 1+1 Δωρεάν Καφέ!'
            };
          } else if (detectedType === 'ENTRY') {
            const currentEntries = userDoc.exists() ? (userDoc.data().totalMonthlyEntries || 0) : 0;
            const newTotal = currentEntries + 1;
            transaction.set(userRef, { totalMonthlyEntries: newTotal }, { merge: true });
            return {
              type: 'ENTRY',
              totalActiveEntries: newTotal,
              message: '1 Συμμετοχή στην κλήρωση καταχωρήθηκε επιτυχώς!'
            };
          } else {
            return {
              type: 'INVALID',
              title: 'Δεν Κερδίσατε τίποτα ❌',
              reason: 'Δεν Κερδίσατε τίποτα'
            };
          }
        }
      });

      sessionCache.current.add(qrContent);
      setScanResult(result);
    } catch (e) {
      console.error("Scan processing error:", e);
      sessionCache.current.add(qrContent);
      setScanResult({
        type: 'INVALID',
        title: 'Δεν Κερδίσατε τίποτα ❌',
        reason: 'Δεν Κερδίσατε τίποτα'
      });
    } finally {
      setValidating(false);
    }
  };

  const addPrizeToUserHistory = async (transaction, userRef, userDoc, prizeName) => {
    try {
      const currentHistory = userDoc.exists() ? (userDoc.data().prizeHistory || []) : [];
      const newPrize = {
        id: `prize_${Date.now()}`,
        prizeName: prizeName,
        dateWonFormatted: new Date().toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        isRedeemed: false
      };
      transaction.set(userRef, { prizeHistory: [newPrize, ...currentHistory] }, { merge: true });
    } catch (e) {
      console.error("Error adding prize history:", e);
    }
  };

  const recordWeeklyWinner = async (prizeName) => {
    try {
      const currentUser = auth.currentUser;
      const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Νικητής';
      const masked = userName.length <= 3 ? `${userName[0]}***` : `${userName[0]}***${userName[userName.length - 1]}`;

      await setDoc(doc(db, 'weekly_winners', `w_${Date.now()}`), {
        username: userName,
        maskedUsername: masked,
        prizeWon: prizeName,
        timestampMillis: Date.now()
      });
    } catch (e) {
      console.error("Error recording weekly winner:", e);
    }
  };

  const handleDismissModal = () => {
    setScanResult(null);
    resumeCamera();
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex flex-col items-center justify-between pb-24">
      {/* Top Bar Header */}
      <div className="w-full pt-6 pb-3 text-center z-10">
        <span className="inline-block px-4 py-1.5 bg-slate-900/80 border border-slate-800 backdrop-blur text-xs font-semibold text-slate-300 rounded-full">
          Τοποθετήστε το QR Code εντός του πλαισίου
        </span>
      </div>

      {/* Camera View / Reader */}
      <div className="relative w-full max-w-md aspect-square flex items-center justify-center p-4">
        {cameraError ? (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center">
            <div className="text-4xl mb-3">📷</div>
            <p className="text-sm font-semibold text-rose-400">{cameraError}</p>
          </div>
        ) : (
          <div className="relative w-full h-full rounded-3xl overflow-hidden border-2 border-amber-500/50 shadow-2xl bg-black">
            <div id="reader" className="w-full h-full object-cover"></div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {validating && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-xs shadow-2xl">
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="font-bold text-white text-lg">Επαλήθευση QR Code...</h3>
            <p className="text-xs text-slate-400 mt-1">Έλεγχος επιβράβευσης στο Firebase</p>
          </div>
        </div>
      )}

      {/* Scan Result Modal Bottom Sheet */}
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
              onClick={handleDismissModal}
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

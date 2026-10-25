import React, { useState, useEffect } from 'react';
import { 
  doc, 
  onSnapshot, 
  updateDoc 
} from 'firebase/firestore';
import { auth, db, getNextDrawTime } from '../firebase';

export default function ProfileTab({ onSignOut }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        const nextDraw = getNextDrawTime();
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: data.displayName || user.displayName || user.email?.split('@')[0] || 'User',
            totalMonthlyEntries: data.totalMonthlyEntries || 0,
            rewardPoints: data.rewardPoints || 0,
            nextDrawTimeMillis: nextDraw,
            prizeHistory: data.prizeHistory || []
          });
        } else {
          setProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            totalMonthlyEntries: 0,
            rewardPoints: 0,
            nextDrawTimeMillis: nextDraw,
            prizeHistory: []
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching profile:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;

    const targetTime =
      profile.nextDrawTimeMillis && profile.nextDrawTimeMillis > Date.now()
        ? profile.nextDrawTimeMillis
        : getNextDrawTime();

    const updateCountdown = () => {
      const diff = Math.max(0, targetTime - Date.now());
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [profile]);

  /**
   * Redeem 50 points for 1+1 Coffee Coupon
   */
  const handleRedeemCoupon = async () => {
    if (!profile || (profile.rewardPoints || 0) < 50) {
      alert('Χρειάζεστε τουλάχιστον 50 πόντους για να εξαργυρώσετε το Κουπόνι Καφές 1+1.');
      return;
    }

    if (window.confirm("Θέλετε να εξαργυρώσετε 50 πόντους για 1 Κουπόνι 'Καφές 1+1';")) {
      try {
        const userRef = doc(db, 'users', profile.uid);
        const newPoints = (profile.rewardPoints || 0) - 50;
        const dateFormatted = new Date().toLocaleDateString('el-GR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const claimCode = `MPRIKI-1PLUS1-${Math.floor(1000 + Math.random() * 9000)}`;
        const prizeName = '☕ Κουπόνι Καφές 1+1';
        const updatedHistory = [
          {
            id: `coupon_1plus1_${Date.now()}`,
            prizeName: prizeName,
            dateWonFormatted: dateFormatted,
            claimCode: claimCode,
            isRedeemed: false
          },
          ...(profile.prizeHistory || [])
        ];

        await updateDoc(userRef, {
          rewardPoints: newPoints,
          prizeHistory: updatedHistory
        });

        alert(
          `🎉 Συγχαρητήρια! Ξεκλειδώσατε το Κουπόνι "Καφές 1+1"!\n\nΚωδικός: ${claimCode}\n\nΜπορείτε να το δείτε στην ενότητα "Τα Δώρα Μου".`
        );
      } catch (err) {
        console.error('Error redeeming 1+1 coupon:', err);
        alert('Σφάλμα κατά την εξαργύρωση του κουπονιού.');
      }
    }
  };

  const initialLetter =
    profile && profile.email ? profile.email.trim()[0].toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-24 max-w-md mx-auto">
      <div className="flex items-center justify-between my-4">
        <h1 className="text-xl font-black text-white">15νθήμερη Μεγάλη Κλήρωση & Προφίλ</h1>
        <button
          onClick={onSignOut}
          className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 font-semibold text-xs rounded-xl hover:bg-rose-500/20 transition"
        >
          Αποσύνδεση
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : (
        profile && (
          <div className="space-y-4">
            {/* Κάρτα Χρήστη */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center font-bold text-2xl border border-amber-500/30">
                {initialLetter}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{profile.displayName}</h2>
                <p className="text-xs text-slate-400">{profile.email}</p>
              </div>
            </div>

            {/* Πόντοι Επιβράβευσης & Εξαργύρωση (50 Πόντοι) */}
            <div className="p-6 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-emerald-600/10 border-2 border-emerald-500/40 rounded-3xl space-y-4 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl">🎯</span>
                  <div>
                    <h3 className="font-black text-emerald-400 text-base tracking-wide">
                      Πόντοι Επιβράβευσης
                    </h3>
                    <p className="text-[11px] text-slate-300 font-medium">
                      +5 πόντοι σε κάθε σκάναρισμα QR
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-500 text-slate-950 text-[11px] font-black rounded-full shadow-lg uppercase tracking-wider">
                  {profile.rewardPoints || 0} Πόντοι
                </span>
              </div>

              {/* Μπάρα Προόδου για 50 Πόντους */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300">Πρόοδος για Κουπόνι Καφές 1+1:</span>
                  <span className="text-emerald-400">{profile.rewardPoints || 0} / 50</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full border border-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500 rounded-full"
                    style={{
                      width: `${Math.min(100, ((profile.rewardPoints || 0) / 50) * 100)}%`
                    }}
                  ></div>
                </div>
              </div>

              {/* Κουμπί Εξαργύρωσης 50 Πόντων */}
              <button
                onClick={handleRedeemCoupon}
                disabled={(profile.rewardPoints || 0) < 50}
                className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-2 ${
                  (profile.rewardPoints || 0) >= 50
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 animate-pulse cursor-pointer'
                    : 'bg-slate-800/80 text-slate-500 border border-slate-700/50 cursor-not-allowed'
                }`}
              >
                <span>🎁</span>
                <span>
                  {(profile.rewardPoints || 0) >= 50
                    ? 'ΕΞΑΡΓΥΡΩΣΗ ΚΟΥΠΟΝΙΟΥ "ΚΑΦΕΣ 1+1" (50 ΠΟΝΤΟΙ)'
                    : `ΧΡΕΙΑΖΕΣΤΕ ΑΚΟΜΑ ${50 - (profile.rewardPoints || 0)} ΠΟΝΤΟΥΣ`}
                </span>
              </button>
            </div>

            {/* Ενεργές Συμμετοχές Κλήρωσης */}
            <div className="p-6 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-3xl text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm mb-1">
                <span>🎟️</span>
                <span>Ενεργές Συμμετοχές 15νθήμερης Κλήρωσης</span>
              </div>
              <div className="text-5xl font-black text-amber-400 my-2">
                {profile.totalMonthlyEntries}
              </div>
              <p className="text-xs text-slate-400">
                Οι επιτυχημένες συμμετοχές από τα σκαναρίσματα προστίθενται στη Μεγάλη Κλήρωση (Γυαλιά Ηλίου, TWS Earbuds & Hoco Bluetooth Headphones)!
              </p>
            </div>

            {/* Αντίστροφη Μέτρηση */}
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                ⏳ Η Επόμενη Κλήρωση σε:
              </h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="block text-2xl font-black text-amber-400">
                    {String(timeLeft.days).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Ημέρες</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="block text-2xl font-black text-amber-400">
                    {String(timeLeft.hours).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Ώρες</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="block text-2xl font-black text-amber-400">
                    {String(timeLeft.minutes).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Λεπτά</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                  <span className="block text-2xl font-black text-amber-400">
                    {String(timeLeft.seconds).padStart(2, '0')}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Δευτερ.</span>
                </div>
              </div>
            </div>

            {/* Δώρα 15νθήμερης Κλήρωσης */}
            <div className="p-6 bg-gradient-to-br from-amber-500/15 via-slate-900 to-amber-600/10 border-2 border-amber-500/40 rounded-3xl space-y-4 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl animate-bounce">🎁</span>
                  <div>
                    <h3 className="font-black text-amber-400 text-base tracking-wide">
                      Δώρα 15νθήμερης Κλήρωσης
                    </h3>
                    <p className="text-[11px] text-slate-300 font-medium">
                      6 Μεγάλα Δώρα σε κάθε κλήρωση
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-amber-500 text-slate-950 text-[11px] font-black rounded-full shadow-lg uppercase tracking-wider">
                  6 Νικητές
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5 pt-1">
                {/* 1ος */}
                <div className="p-4 bg-slate-950/90 border border-amber-500/50 rounded-2xl flex items-center justify-between shadow-lg relative overflow-hidden">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center font-bold text-2xl border border-amber-500/30 shrink-0">
                      🕶️
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-md uppercase tracking-wider">
                        1ος Νικητής
                      </span>
                      <h4 className="font-extrabold text-white text-xs mt-1">1 Ζευγάρι Γυαλιά Ηλίου</h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-400 shrink-0 ml-2">🕶️ Γυαλιά Ηλίου</span>
                </div>

                {/* 2ος */}
                <div className="p-4 bg-slate-950/90 border border-purple-500/40 rounded-2xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center font-bold text-2xl border border-purple-500/30 shrink-0">
                      🎧
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-purple-500 text-white text-[10px] font-black rounded-md uppercase tracking-wider">
                        2ος Νικητής
                      </span>
                      <h4 className="font-extrabold text-white text-xs mt-1">TWS Wireless Earbuds</h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-purple-400 shrink-0 ml-2">🎧 Earbuds</span>
                </div>

                {/* 3ος */}
                <div className="p-4 bg-slate-950/90 border border-slate-700/60 rounded-2xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-slate-700/30 text-slate-200 rounded-2xl flex items-center justify-center font-bold text-2xl border border-slate-700/50 shrink-0">
                      🎧
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-slate-300 text-slate-950 text-[10px] font-black rounded-md uppercase tracking-wider">
                        3ος Νικητής
                      </span>
                      <h4 className="font-extrabold text-white text-xs mt-1">HOCO W35 Silver Bluetooth</h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-300 shrink-0 ml-2">🎧 Silver Headset</span>
                </div>

                {/* 4ος */}
                <div className="p-4 bg-slate-950/90 border border-cyan-500/40 rounded-2xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center font-bold text-2xl border border-cyan-500/30 shrink-0">
                      🎧
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-cyan-500 text-slate-950 text-[10px] font-black rounded-md uppercase tracking-wider">
                        4ος Νικητής
                      </span>
                      <h4 className="font-extrabold text-white text-xs mt-1">
                        NOD Soundtube TWS Earphones
                      </h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-cyan-400 shrink-0 ml-2">🎧 Soundtube TWS</span>
                </div>

                {/* 5ος */}
                <div className="p-4 bg-slate-950/90 border border-cyan-500/40 rounded-2xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-cyan-500/20 text-cyan-400 rounded-2xl flex items-center justify-center font-bold text-2xl border border-cyan-500/30 shrink-0">
                      🎧
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-cyan-500 text-slate-950 text-[10px] font-black rounded-md uppercase tracking-wider">
                        5ος Νικητής
                      </span>
                      <h4 className="font-extrabold text-white text-xs mt-1">
                        NOD Soundtube TWS Earphones
                      </h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-cyan-400 shrink-0 ml-2">🎧 Soundtube TWS</span>
                </div>

                {/* 6ος */}
                <div className="p-4 bg-slate-950/90 border border-blue-500/40 rounded-2xl flex items-center justify-between shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center font-bold text-2xl border border-blue-500/30 shrink-0">
                      🎧
                    </div>
                    <div>
                      <span className="px-2 py-0.5 bg-blue-500 text-white text-[10px] font-black rounded-md uppercase tracking-wider">
                        6ος Νικητής
                      </span>
                      <h4 className="font-extrabold text-white text-xs mt-1">
                        HOCO W35 MAX Blue Bluetooth
                      </h4>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-blue-400 shrink-0 ml-2">🎧 Blue Headset</span>
                </div>
              </div>
            </div>

            {/* Τα Δώρα Μου & Επιβραβεύσεις */}
            <div className="pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white text-sm flex items-center gap-2">
                  <span>🏆</span>
                  <span>Τα Δώρα Μου & Επιβραβεύσεις</span>
                </h3>
                <span className="text-xs text-amber-400 font-semibold">
                  {profile.prizeHistory?.length || 0} Δώρα
                </span>
              </div>

              {!profile.prizeHistory || profile.prizeHistory.length === 0 ? (
                <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                  <p className="text-xs text-slate-400">
                    Δεν έχετε κερδίσει κάποιο δώρο ακόμα. Σκανάρετε τα QR codes στους καφέδες σας για να κερδίσετε! ☕
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.prizeHistory.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between shadow-lg"
                    >
                      <div>
                        <h4 className="font-bold text-amber-400 text-sm">{item.prizeName}</h4>
                        <p className="text-[11px] text-slate-400">
                          Κερδήθηκε: {item.dateWonFormatted || 'Πρόσφατα'}
                        </p>
                        {item.claimCode && (
                          <p className="text-xs font-mono font-bold text-slate-200 mt-1">
                            Κωδικός: <span className="text-amber-400">{item.claimCode}</span>
                          </p>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 font-bold text-[10px] rounded-full border ${
                          item.isRedeemed
                            ? 'bg-slate-800 text-slate-500 border-slate-700'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                        }`}
                      >
                        {item.isRedeemed ? '✓ Εξαργυρώθηκε' : '🎉 Διαθέσιμο (10 Ημέρες)'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Όροι Χρήσης & Πολιτική Απορρήτου Accordion */}
            <div className="pt-4 border-t border-slate-800">
              <details className="group bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition">
                <summary className="p-4 font-bold text-slate-300 text-xs flex items-center justify-between cursor-pointer select-none hover:text-amber-400">
                  <span className="flex items-center gap-2">
                    <span>📄</span>
                    <span>Όροι Χρήσης & Πολιτική Απορρήτου</span>
                  </span>
                  <span className="text-slate-500 group-open:rotate-180 transition-transform">▼</span>
                </summary>
                <div className="p-4 pt-0 text-[11px] text-slate-400 space-y-3 border-t border-slate-800/50">
                  <div>
                    <h5 className="font-bold text-slate-200 mb-1">
                      1. Επεξεργασία Προσωπικών Δεδομένων (GDPR)
                    </h5>
                    <p>
                      Με την εγγραφή και χρήση της εφαρμογής Mpriki Winners, παρέχετε τη ρητή συγκατάθεσή σας για την επεξεργασία των προσωπικών σας δεδομένων (ονοματεπώνυμο, ηλεκτρονική διεύθυνση, ιστορικό σαρώσεων και δώρων) αποκλειστικά για τους σκοπούς της προωθητικής ενέργειας και του προγράμματος επιβράβευσης του καταστήματος "Mpriki".
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-200 mb-1">
                      2. Πολιτική Cookies & Τοπικής Αποθήκευσης (Local Storage)
                    </h5>
                    <p>
                      Η εφαρμογή χρησιμοποιεί αποκλειστικά τεχνικώς απαραίτητη τοπική αποθήκευση (Local Storage μέσω Firebase Auth) για τη διατήρηση της ασφαλούς σύνδεσης του λογαριασμού σας.{' '}
                      <strong className="text-slate-300">
                        Δεν χρησιμοποιούνται cookies παρακολούθησης (tracking) ή διαφημιστικά cookies τρίτων.
                      </strong>
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-200 mb-1">
                      3. Δικαίωμα Συμμετοχής & Όριο Ηλικίας (18+)
                    </h5>
                    <p>
                      Η συμμετοχή στο πρόγραμμα επιβράβευσης και στις κληρώσεις επιτρέπεται αυστηρά σε άτομα που έχουν συμπληρώσει το 18ο έτος της ηλικίας τους (ή σε ανηλίκους με ρητή συγκατάθεση γονέα/κηδεμόνα).
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-200 mb-1">
                      4. Δικαίωμα Διαγραφής Δεδομένων
                    </h5>
                    <p>
                      Έχετε το δικαίωμα ανά πάσα στιγμή να ζητήσετε την οριστική διαγραφή του λογαριασμού και των προσωπικών σας δεδομένων. Για να ασκήσετε το δικαίωμα διαγραφής, παρακαλούμε αποστείλετε αίτημα μέσω email στην ηλεκτρονική διεύθυνση:{' '}
                      <a href="mailto:info@ntvelop.gr" className="text-amber-400 font-bold underline">
                        info@ntvelop.gr
                      </a>
                      .
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-amber-400 mb-1">
                      5. Λήξη Ισχύος Δώρων (10 Ημέρες)
                    </h5>
                    <p className="text-slate-300">
                      ⚠️ Όλα τα δώρα που κερδίζονται (Δωρεάν Καφέδες & Gift Boxes) διατηρούν ισχύ για{' '}
                      <strong className="text-amber-400">δέκα (10) ημερολογιακές ημέρες</strong> από την ημερομηνία απόκτησής τους. Εάν το δώρο δεν εξαργυρωθεί στο κατάστημα Mpriki εντός 10 ημερών, ακυρώνεται αυτόματα και παραγράφεται οριστικά.
                    </p>
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-200 mb-1">
                      6. Νομικό Πλαίσιο & Όροι Επιβράβευσης
                    </h5>
                    <ul className="list-disc pl-4 space-y-1 text-slate-400">
                      <li>
                        <strong>Όριο 1 Δώρου ανά Νικητή:</strong> Πολλαπλές συμμετοχές από σκαναρίσματα αυξάνουν τις πιθανότητες κέρδους, αλλά κάθε χρήστης μπορεί να αναδειχθεί νικητής σε <u>ένα μόνο δώρο ανά κλήρωση</u>.
                      </li>
                      <li>
                        <strong>Προσωπικός Χαρακτήρας:</strong> Τα δώρα και οι συμμετοχές είναι αυστηρά προσωπικά, δεν μεταβιβάζονται σε τρίτους και δεν ανταλλάσσονται με χρηματικά ποσά.
                      </li>
                      <li>
                        <strong>Κακόβουλη Χρήση:</strong> Απαγορεύεται η παραποίηση QR codes, η χρήση αυτοματοποιημένων λογισμικών ή η δημιουργία πολλαπλών ψευδών λογαριασμών. Το κατάστημα διατηρεί το δικαίωμα άμεσης διαγραφής παραβατών.
                      </li>
                      <li>
                        <strong>Τροποποίηση Προγράμματος:</strong> Το κατάστημα Mpriki διατηρεί το δικαίωμα να τροποποιήσει τους όρους, τα δώρα ή να τερματίσει την προωθητική ενέργεια ανά πάσα στιγμή.
                      </li>
                      <li>
                        <strong>Περιορισμός Ευθύνης:</strong> Η εταιρεία ανάπτυξης (Ntvelop) και το κατάστημα Mpriki δεν φέρουν ευθύνη για τεχνικές διακοπές δικτύου ή ασυμβατότητα συσκευών.
                      </li>
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )
      )}
    </div>
  );
}

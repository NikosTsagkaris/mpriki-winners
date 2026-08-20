import React, { useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { getNextDrawTimeMillis } from '../utils/monthlyDrawSchedule';
import AdBanner from './AdBanner';

export default function ProfileScreen({ onSignOut }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [latestDrawWinner, setLatestDrawWinner] = useState(null);
  const [remainingTime, setRemainingTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setProfile({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: data.displayName || currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          totalMonthlyEntries: data.totalMonthlyEntries || 0,
          nextDrawTimeMillis: data.nextDrawTimeMillis || getNextDrawTimeMillis(),
          prizeHistory: data.prizeHistory || []
        });
      } else {
        setProfile({
          uid: currentUser.uid,
          email: currentUser.email || '',
          displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          totalMonthlyEntries: 0,
          nextDrawTimeMillis: getNextDrawTimeMillis(),
          prizeHistory: []
        });
      }
      setLoading(false);
    }, (err) => {
      console.error("Error fetching profile:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Live Countdown Timer
  useEffect(() => {
    if (!profile) return;

    const targetTime = profile.nextDrawTimeMillis || getNextDrawTimeMillis();

    const updateTimer = () => {
      const diff = Math.max(0, targetTime - Date.now());
      if (diff <= 0 && !latestDrawWinner) {
        handleTimerExpired();
      }

      setRemainingTime({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60)
      });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [profile]);

  const handleTimerExpired = async () => {
    if (!profile) return;
    const winnerName = profile.displayName || profile.email.split('@')[0];
    setLatestDrawWinner(winnerName);

    try {
      const masked = winnerName.length <= 3 ? `${winnerName[0]}***` : `${winnerName[0]}***${winnerName[winnerName.length - 1]}`;
      await setDoc(doc(db, 'weekly_winners', `w_${Date.now()}`), {
        username: winnerName,
        maskedUsername: masked,
        prizeWon: 'Μεγάλη Μηνιαία Κλήρωση: Gift Box',
        timestampMillis: Date.now()
      });

      const nextTarget = getNextDrawTimeMillis(Date.now() + 1000);
      await updateDoc(doc(db, 'users', profile.uid), {
        nextDrawTimeMillis: nextTarget
      });
    } catch (e) {
      console.error("Error drawing winner:", e);
    }
  };

  const userInitial = profile?.email ? profile.email.trim()[0].toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between my-4">
        <h1 className="text-xl font-black text-white">Μηνιαία Μεγάλη Κλήρωση & Προφίλ</h1>
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
      ) : profile && (
        <div className="space-y-4">
          {/* User Banner Header with Email Avatar */}
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-3xl flex items-center gap-4">
            <div className="w-14 h-14 bg-amber-500/20 text-amber-400 rounded-full flex items-center justify-center font-bold text-2xl border border-amber-500/30">
              {userInitial}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{profile.displayName}</h2>
              <p className="text-xs text-slate-400">{profile.email}</p>
            </div>
          </div>

          {/* Ticket Counter Card */}
          <div className="p-6 bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 rounded-3xl text-center">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-sm mb-1">
              <span>🎟️</span>
              <span>Ενεργές Συμμετοχές Μηνιαίας Κλήρωσης</span>
            </div>
            <div className="text-5xl font-black text-amber-400 my-2">{profile.totalMonthlyEntries}</div>
            <p className="text-xs text-slate-400">
              Οι επιτυχημένες συμμετοχές από τα σκαναρίσματα προστίθενται στη Μεγάλη Μηνιαία Κλήρωση!
            </p>
          </div>

          {/* Ad Banner Promo */}
          <AdBanner 
            sponsorTitle="Ειδικές Προσφορές & Εκπτώσεις Συνεργατών!" 
            sponsorLink="#"
          />

          {/* Live Countdown Timer Card */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-center">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              ⏳ Η Επόμενη Μεγάλη Μηνιαία Κλήρωση σε:
            </h3>

            <div className="grid grid-cols-4 gap-2">
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="block text-2xl font-black text-amber-400">{String(remainingTime.days).padStart(2, '0')}</span>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Ημέρες</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="block text-2xl font-black text-amber-400">{String(remainingTime.hours).padStart(2, '0')}</span>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Ώρες</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="block text-2xl font-black text-amber-400">{String(remainingTime.minutes).padStart(2, '0')}</span>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Λεπτά</span>
              </div>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl">
                <span className="block text-2xl font-black text-amber-400">{String(remainingTime.seconds).padStart(2, '0')}</span>
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Δευτερ.</span>
              </div>
            </div>
          </div>

          {/* Winner Banner */}
          {latestDrawWinner && (
            <div className="p-4 bg-amber-500/20 border border-amber-500/40 rounded-2xl flex items-center gap-3">
              <span className="text-3xl">🎉</span>
              <div>
                <h4 className="font-bold text-white text-sm">Νέος Νικητής Μηνιαίας Κλήρωσης!</h4>
                <p className="text-xs text-slate-300">Ο/Η {latestDrawWinner} αναδείχθηκε νικητής/τρια!</p>
              </div>
            </div>
          )}

          {/* Prize History Header */}
          <div className="pt-4">
            <h3 className="font-bold text-white text-sm mb-3">Ιστορικό Δώρων & Επιβραβεύσεων</h3>

            {profile.prizeHistory.length === 0 ? (
              <div className="p-6 bg-slate-900/50 border border-slate-800 rounded-2xl text-center">
                <p className="text-xs text-slate-400">
                  Δεν έχετε κερδίσει κάποιο δώρο ακόμα. Συνεχίστε το σκανάρισμα QR codes!
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {profile.prizeHistory.map((prize) => (
                  <div key={prize.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{prize.prizeName}</h4>
                      <p className="text-[11px] text-slate-500">Κερδήθηκε στις {prize.dateWonFormatted}</p>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[10px] rounded-lg">
                      {prize.isRedeemed ? 'Εξαργυρώθηκε' : 'Διαθέσιμο'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

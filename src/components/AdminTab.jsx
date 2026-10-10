import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch 
} from 'firebase/firestore';
import { db, getNextDrawTime } from '../firebase';

export default function AdminTab() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [adminSubTab, setAdminSubTab] = useState('winners');

  const [posCoffees, setPosCoffees] = useState(null);
  const [posStatus, setPosStatus] = useState('loading');

  const [usersList, setUsersList] = useState([]);
  const [qrTokensList, setQrTokensList] = useState([]);
  const [winnersList, setWinnersList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('all');
  const [winnerSearchTerm, setWinnerSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [drawResults, setDrawResults] = useState(null);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput.trim() === 'ZOUZO9911@7') {
      setIsAuthenticated(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  useEffect(() => {
    const fetchPosStats = async () => {
      try {
        const res = await fetch('http://192.168.1.50:8000/orders/stats', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          setPosCoffees(data.total_coffees_printed || 0);
          setPosStatus('online');
        } else {
          setPosStatus('offline');
        }
      } catch (err) {
        setPosStatus('offline');
      }
    };

    fetchPosStats();
    const interval = setInterval(fetchPosStats, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const arr = [];
      snapshot.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setUsersList(arr);
    });

    const unsubQrs = onSnapshot(collection(db, 'qr_tokens'), (snapshot) => {
      const arr = [];
      snapshot.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      setQrTokensList(arr);
    });

    const unsubWinners = onSnapshot(collection(db, 'weekly_winners'), (snapshot) => {
      const arr = [];
      snapshot.forEach((d) => arr.push({ id: d.id, ...d.data() }));
      arr.sort((a, b) => {
        const timeA = a.timestampMillis || 0;
        const timeB = b.timestampMillis || 0;
        if (Math.abs(timeA - timeB) > 60000) {
          return timeB - timeA;
        }
        return (a.rank || 0) - (b.rank || 0);
      });
      setWinnersList(arr);
    });

    return () => {
      unsubUsers();
      unsubQrs();
      unsubWinners();
    };
  }, [isAuthenticated]);

  const togglePrizeRedeemed = async (userId, prizeId, currentStatus) => {
    try {
      const user = usersList.find((u) => u.id === userId);
      if (!user) return;
      const history = (user.prizeHistory || []).map((p, idx) => {
        const idToMatch = p.id || `prize_${idx}`;
        if (idToMatch === prizeId) {
          return { ...p, isRedeemed: !currentStatus };
        }
        return p;
      });
      await updateDoc(doc(db, 'users', userId), { prizeHistory: history });
    } catch (err) {
      console.error('Error toggling prize redemption:', err);
      alert('Σφάλμα κατά την ενημέρωση.');
    }
  };

  const handleRunRaffle = async () => {
    if (!window.confirm('Είστε βέβαιοι ότι θέλετε να εκτελέσετε την Κλήρωση 15ημέρου και να μηδενίσετε τις συμμετοχές;')) {
      return;
    }

    setActionLoading(true);
    try {
      const candidateTickets = [];
      const excludedEmails = ['nspanoudis2@gmail.com', 'johnvaltzis@gmail.com'];

      usersList.forEach((u) => {
        const email = (u.email || '').toLowerCase().trim();
        const entries = u.totalMonthlyEntries || 0;
        if (entries > 0 && !excludedEmails.includes(email)) {
          const name = u.displayName || u.email?.split('@')[0] || 'User';
          for (let i = 0; i < entries; i++) {
            candidateTickets.push({ uid: u.id, name: name, email: u.email || '', totalMonthlyEntries: entries });
          }
        }
      });

      if (candidateTickets.length === 0) {
        alert('Δεν υπάρχουν συμμετοχές για κλήρωση!');
        setActionLoading(false);
        return;
      }

      const prizes = [
        '🕶️ 1ος Νικητής: 1 Ζευγάρι Γυαλιά Ηλίου',
        '🎧 2ος Νικητής: TWS Wireless Earbuds',
        '🎧 3ος Νικητής: HOCO W35 Silver Bluetooth',
        '🎧 4ος Νικητής: NOD Soundtube TWS Earphones',
        '🎧 5ος Νικητής: NOD Soundtube TWS Earphones',
        '🎧 6ος Νικητής: HOCO W35 MAX Blue Bluetooth'
      ];

      const drawn = [];
      const pickedUids = new Set();
      let pool = [...candidateTickets];
      const now = Date.now();
      const dateFormatted = new Date(now).toLocaleDateString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      for (let rank = 0; rank < 6; rank++) {
        const remaining = pool.filter((t) => !pickedUids.has(t.uid));
        if (remaining.length === 0) break;

        const randomIndex = Math.floor(Math.random() * remaining.length);
        const winner = remaining[randomIndex];

        pickedUids.add(winner.uid);
        pool = pool.filter((t) => t.uid !== winner.uid);

        const maskedName =
          winner.name.length <= 3
            ? `${winner.name[0]}***`
            : `${winner.name[0]}***${winner.name[winner.name.length - 1]}`;

        const prizeTitle = prizes[rank];

        drawn.push({
          id: winner.uid,
          displayName: winner.name,
          email: winner.email,
          totalMonthlyEntries: winner.totalMonthlyEntries,
          prize: prizeTitle,
          rank: rank + 1
        });

        await setDoc(doc(db, 'weekly_winners', `raffle_${now}_${rank + 1}`), {
          username: winner.name,
          email: winner.email,
          maskedUsername: maskedName,
          prizeWon: prizeTitle,
          rank: rank + 1,
          timestampMillis: now,
          drawDateFormatted: dateFormatted
        });

        const userDocRef = doc(db, 'users', winner.uid);
        const existingHistory = usersList.find((u) => u.id === winner.uid)?.prizeHistory || [];
        await updateDoc(userDocRef, {
          prizeHistory: [
            {
              id: `raffle_${now}_${rank}`,
              prizeName: prizeTitle,
              dateWonFormatted: dateFormatted,
              isRedeemed: false
            },
            ...existingHistory
          ]
        });
      }

      // Reset monthly entries
      const nextDraw = getNextDrawTime(now + 1000);
      const batch = writeBatch(db);
      usersList.forEach((u) => {
        batch.update(doc(db, 'users', u.id), {
          totalMonthlyEntries: 0,
          nextDrawTimeMillis: nextDraw
        });
      });
      await batch.commit();

      // Μηδενισμός σκαναρισμένων QR tokens
      try {
        const qrSnapshot = await getDocs(collection(db, 'qr_tokens'));
        if (!qrSnapshot.empty) {
          let qrBatch = writeBatch(db);
          let qCount = 0;
          for (const docSnap of qrSnapshot.docs) {
            qrBatch.delete(docSnap.ref);
            qCount++;
            if (qCount % 400 === 0) {
              await qrBatch.commit();
              qrBatch = writeBatch(db);
            }
          }
          if (qCount % 400 !== 0) {
            await qrBatch.commit();
          }
        }
        setQrTokensList([]);
      } catch (qrErr) {
        console.error('Error clearing qr_tokens during raffle:', qrErr);
      }

      // Μηδενισμός μετρητή καφέδων POS
      try {
        await fetch('http://192.168.1.50:8000/orders/reset_counter', {
          method: 'POST',
          cache: 'no-store'
        });
        setPosCoffees(0);
      } catch (posErr) {
        console.warn('POS reset counter failed or offline:', posErr);
        try {
          await fetch('http://192.168.1.50:8000/orders/reset_counter', { cache: 'no-store' });
          setPosCoffees(0);
        } catch (e) {}
      }

      setDrawResults(drawn);
      alert('🎉 Η κλήρωση ολοκληρώθηκε επιτυχώς! Οι συμμετοχές, τα QR και οι καφέδες POS μηδενίστηκαν.');
    } catch (err) {
      console.error('Error running raffle:', err);
      alert('Σφάλμα κατά την εκτέλεση της κλήρωσης.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualResetCycle = async () => {
    if (
      !window.confirm(
        'ΠΡΟΣΟΧΗ: Θέλετε να μηδενίσετε χειροκίνητα όλες τις συμμετοχές των χρηστών, τα QR και τους καφέδες POS για τον νέο κύκλο;'
      )
    ) {
      return;
    }

    setActionLoading(true);
    try {
      const nextDraw = getNextDrawTime(Date.now() + 1000);
      const batch = writeBatch(db);
      usersList.forEach((u) => {
        batch.update(doc(db, 'users', u.id), {
          totalMonthlyEntries: 0,
          nextDrawTimeMillis: nextDraw
        });
      });
      await batch.commit();

      // Μηδενισμός σκαναρισμένων QR tokens
      try {
        const qrSnapshot = await getDocs(collection(db, 'qr_tokens'));
        if (!qrSnapshot.empty) {
          let qrBatch = writeBatch(db);
          let qCount = 0;
          for (const docSnap of qrSnapshot.docs) {
            qrBatch.delete(docSnap.ref);
            qCount++;
            if (qCount % 400 === 0) {
              await qrBatch.commit();
              qrBatch = writeBatch(db);
            }
          }
          if (qCount % 400 !== 0) {
            await qrBatch.commit();
          }
        }
        setQrTokensList([]);
      } catch (qrErr) {
        console.error('Error clearing qr_tokens during manual reset:', qrErr);
      }

      // Μηδενισμός μετρητή καφέδων POS
      try {
        await fetch('http://192.168.1.50:8000/orders/reset_counter', {
          method: 'POST',
          cache: 'no-store'
        });
        setPosCoffees(0);
      } catch (posErr) {
        console.warn('POS reset counter failed or offline:', posErr);
        try {
          await fetch('http://192.168.1.50:8000/orders/reset_counter', { cache: 'no-store' });
          setPosCoffees(0);
        } catch (e) {}
      }

      alert('✅ Ο κύκλος συμμετοχών, τα QR και οι καφέδες POS μηδενίστηκαν επιτυχώς!');
    } catch (err) {
      console.error('Error resetting cycle:', err);
      alert('Σφάλμα κατά τον μηδενισμό.');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30 text-3xl">
            👑
          </div>
          <h2 className="text-xl font-black text-white uppercase tracking-wide">Admin Panel</h2>
          <p className="text-xs text-slate-400 mt-1 mb-6">Εισάγετε τον Κωδικό Διαχειριστή Mpriki</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="Κωδικός Διαχειριστή"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-center text-lg font-bold text-amber-400 focus:outline-none focus:border-amber-500"
              autoFocus
            />
            {passwordError && (
              <p className="text-xs font-semibold text-rose-400">❌ Λανθασμένος Κωδικός. Δοκιμάστε ξανά.</p>
            )}
            <button
              type="submit"
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl transition"
            >
              Είσοδος στο Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Συλλογή όλων των εκκρεμών (ανεξαργύρωτων) δώρων για άμεση προβολή πάνω-πάνω
  const pendingPrizes = [];
  usersList.forEach((u) => {
    (u.prizeHistory || []).forEach((p, idx) => {
      if (!p.isRedeemed) {
        pendingPrizes.push({
          userId: u.id,
          userName: u.displayName || u.email?.split('@')[0] || 'Χρήστης',
          userEmail: u.email || '',
          prizeId: p.id || `prize_${idx}`,
          prizeName: p.prizeName,
          dateWonFormatted: p.dateWonFormatted || '',
          isRedeemed: false
        });
      }
    });
  });

  const totalUsersWithUnredeemed = usersList.filter((u) =>
    (u.prizeHistory || []).some((p) => !p.isRedeemed)
  ).length;

  const totalUsersWithPrizes = usersList.filter(
    (u) => (u.prizeHistory || []).length > 0
  ).length;

  const filteredUsers = usersList.filter((u) => {
    const q = searchTerm.toLowerCase().trim();
    const name = (u.displayName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    const matchesSearch = !q || name.includes(q) || email.includes(q);
    if (!matchesSearch) return false;

    const hasUnredeemed = (u.prizeHistory || []).some((p) => !p.isRedeemed);
    const hasAnyPrize = (u.prizeHistory || []).length > 0;

    if (userFilter === 'unredeemed') return hasUnredeemed;
    if (userFilter === 'winners') return hasAnyPrize;
    return true;
  });

  // ΑΥΤΟΜΑΤΗ ΤΑΞΙΝΟΜΗΣΗ: Οι νικητές βγαίνουν ΠΑΝΩ-ΠΑΝΩ!
  // 1. Χρήστες με εκκρεμή δώρα (ύψιστη προτεραιότητα)
  // 2. Χρήστες που έχουν κερδίσει δώρα (ιστορικό)
  // 3. Χρήστες με τις περισσότερες συμμετοχές / λαχνούς
  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const aUnredeemed = (a.prizeHistory || []).filter((p) => !p.isRedeemed).length;
    const bUnredeemed = (b.prizeHistory || []).filter((p) => !p.isRedeemed).length;
    if (aUnredeemed !== bUnredeemed) {
      return bUnredeemed - aUnredeemed;
    }

    const aPrizes = (a.prizeHistory || []).length;
    const bPrizes = (b.prizeHistory || []).length;
    if (aPrizes !== bPrizes) {
      return bPrizes - aPrizes;
    }

    return (b.totalMonthlyEntries || 0) - (a.totalMonthlyEntries || 0);
  });

  const filteredWinners = winnersList.filter((w) => {
    const q = winnerSearchTerm.toLowerCase().trim();
    if (!q) return true;
    const name = (w.username || '').toLowerCase();
    const email = (w.email || '').toLowerCase();
    const prize = (w.prizeWon || '').toLowerCase();
    return name.includes(q) || email.includes(q) || prize.includes(q);
  });

  const totalActiveRaffleTickets = usersList.reduce(
    (acc, curr) => acc + (curr.totalMonthlyEntries || 0),
    0
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      <header className="w-full bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">👑</span>
            <h1 className="font-black text-base text-white">Mpriki Admin Console</h1>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                posStatus === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            ></span>
            <span className="text-[11px] text-slate-400 font-semibold">
              POS: {posStatus === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Στατιστικά Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block mb-1">Χρήστες</span>
            <span className="text-2xl font-black text-white">{usersList.length}</span>
          </div>
          <div
            onClick={() => {
              setAdminSubTab('users');
              setUserFilter('unredeemed');
            }}
            className={`p-4 rounded-2xl text-center border cursor-pointer transition ${
              pendingPrizes.length > 0
                ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10 hover:bg-amber-500/25'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
            title="Κλικ για προβολή εκκρεμών δώρων"
          >
            <span className="text-xs font-bold text-amber-400 block mb-1">🎁 Εκκρεμή Δώρα</span>
            <span className="text-2xl font-black text-amber-400 flex items-center justify-center gap-1.5">
              {pendingPrizes.length}
              {pendingPrizes.length > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping inline-block" />
              )}
            </span>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block mb-1">Συμμετοχές (Λαχνοί)</span>
            <span className="text-2xl font-black text-amber-400">{totalActiveRaffleTickets}</span>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block mb-1">Σκαναρισμένα QR</span>
            <span className="text-2xl font-black text-cyan-400">{qrTokensList.length}</span>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center col-span-2 sm:col-span-1">
            <span className="text-xs font-semibold text-slate-400 block mb-1">Καφέδες POS</span>
            <span className="text-2xl font-black text-emerald-400">{posCoffees ?? 'N/A'}</span>
          </div>
        </div>

        {/* ΠΑΝΩ-ΠΑΝΩ: Κάρτα Άμεσης Εξαργύρωσης Νικητών αν υπάρχουν εκκρεμή δώρα */}
        {pendingPrizes.length > 0 && (
          <div className="bg-gradient-to-br from-amber-500/20 via-amber-950/20 to-slate-900 border-2 border-amber-500/50 rounded-3xl p-5 shadow-2xl space-y-4 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl font-bold shadow-lg shadow-amber-500/20 shrink-0">
                  🎁
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-white">
                      Νικητές με Εκκρεμή Δώρα προς Εξαργύρωση
                    </h2>
                    <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 font-black text-xs rounded-full animate-pulse shadow-sm">
                      {pendingPrizes.length} ΣΕ ΑΝΑΜΟΝΗ
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Εμφανίζονται πρώτοι για άμεση εξυπηρέτηση. Πατήστε «Εξαργύρωση» για να παραδοθεί το δώρο στον πελάτη.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pendingPrizes.map((item, idx) => (
                <div
                  key={`${item.userId}_${item.prizeId}_${idx}`}
                  className="p-3.5 bg-slate-950/90 border border-amber-500/40 hover:border-amber-400 rounded-2xl flex flex-col justify-between gap-3 shadow-lg transition"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-black text-white truncate">
                        {item.userName}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded border border-amber-500/30 shrink-0">
                        👑 Νικητής
                      </span>
                    </div>
                    <p className="text-xs font-black text-amber-400 mt-1 line-clamp-2">
                      {item.prizeName}
                    </p>
                    <div className="text-[11px] text-slate-400 mt-1.5 space-y-0.5">
                      {item.userEmail && <p className="truncate">📧 {item.userEmail}</p>}
                      {item.dateWonFormatted && <p>🗓️ {item.dateWonFormatted}</p>}
                    </div>
                  </div>

                  <button
                    onClick={() => togglePrizeRedeemed(item.userId, item.prizeId, false)}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span>✅</span>
                    <span>Εξαργύρωση Τώρα</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subtabs navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setAdminSubTab('winners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              adminSubTab === 'winners'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            <span>🏆 Νικητές ({winnersList.length})</span>
          </button>
          <button
            onClick={() => setAdminSubTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
              adminSubTab === 'users'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            <span>👥 Χρήστες ({usersList.length})</span>
            {totalUsersWithUnredeemed > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                adminSubTab === 'users'
                  ? 'bg-slate-950 text-amber-400'
                  : 'bg-amber-500 text-slate-950'
              }`}>
                {totalUsersWithUnredeemed}
              </span>
            )}
          </button>
          <button
            onClick={() => setAdminSubTab('raffle')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              adminSubTab === 'raffle'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            🎲 Κλήρωση 15ημέρου
          </button>
        </div>

        {/* Subtab: Winners */}
        {adminSubTab === 'winners' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>🏆</span>
                <span>Λίστα Νικητών & Εξαργυρώσεων</span>
              </h2>
              <input
                type="text"
                placeholder="🔍 Αναζήτηση νικητή ή δώρου..."
                value={winnerSearchTerm}
                onChange={(e) => setWinnerSearchTerm(e.target.value)}
                className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-64"
              />
            </div>

            {filteredWinners.length === 0 ? (
              <p className="text-sm text-slate-500 py-6 text-center">Δεν βρέθηκαν καταγεγραμμένοι νικητές.</p>
            ) : (
              <div className="space-y-2">
                {filteredWinners.map((w) => {
                  const userMatch = usersList.find((u) =>
                    (w.email && u.email && u.email.toLowerCase() === w.email.toLowerCase()) ||
                    (w.username && u.displayName && u.displayName.toLowerCase() === w.username.toLowerCase())
                  );
                  const matchingPrize = (userMatch?.prizeHistory || []).find((p) =>
                    p.prizeName === w.prizeWon || (p.dateWonFormatted && p.dateWonFormatted === w.drawDateFormatted)
                  );
                  const prizeId = matchingPrize ? (matchingPrize.id || 'prize_0') : null;

                  return (
                    <div
                      key={w.id}
                      className={`p-3.5 bg-slate-950 border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition ${
                        matchingPrize && !matchingPrize.isRedeemed
                          ? 'border-amber-500/40 bg-amber-500/5'
                          : 'border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold text-white text-sm">{w.username || w.email}</p>
                          {matchingPrize && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              matchingPrize.isRedeemed
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {matchingPrize.isRedeemed ? '✅ Εξαργυρώθηκε' : '⏳ Εκκρεμεί Παράδοση'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-bold text-amber-400 mt-0.5">{w.prizeWon}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1">
                          {w.email && <span>📧 {w.email}</span>}
                          {w.drawDateFormatted && <span>🗓️ {w.drawDateFormatted}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {userMatch && matchingPrize && (
                          <button
                            onClick={() => togglePrizeRedeemed(userMatch.id, prizeId, matchingPrize.isRedeemed)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                              matchingPrize.isRedeemed
                                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                                : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-md'
                            }`}
                          >
                            {matchingPrize.isRedeemed ? '↩️ Ακύρωση' : '⚡ Εξαργύρωση'}
                          </button>
                        )}
                        <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-lg border border-amber-500/30">
                          {w.rank ? `#${w.rank}` : '1+1'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Subtab: Users */}
        {adminSubTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>👥</span>
                  <span>Λίστα Εγγεγραμμένων Χρηστών ({usersList.length})</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  👑 Οι νικητές με δώρα τοποθετούνται αυτόματα πάνω-πάνω στη λίστα.
                </p>
              </div>
              <input
                type="text"
                placeholder="🔍 Αναζήτηση με όνομα ή email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-64"
              />
            </div>

            {/* Γρήγορα Φίλτρα για εύκολη εύρεση */}
            <div className="flex items-center gap-2 flex-wrap pt-1">
              <button
                onClick={() => setUserFilter('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  userFilter === 'all'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                👥 Όλοι ({usersList.length})
              </button>
              <button
                onClick={() => setUserFilter('unredeemed')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  userFilter === 'unredeemed'
                    ? 'bg-amber-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-amber-400 hover:bg-amber-500/10 border border-amber-500/30'
                }`}
              >
                <span>⏳ Εκκρεμή Δώρα</span>
                <span className="px-1.5 py-0.2 bg-amber-950 text-amber-300 rounded-md text-[10px]">
                  {totalUsersWithUnredeemed}
                </span>
              </button>
              <button
                onClick={() => setUserFilter('winners')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  userFilter === 'winners'
                    ? 'bg-emerald-500 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/30'
                }`}
              >
                <span>🏆 Όλοι οι Νικητές</span>
                <span className="px-1.5 py-0.2 bg-emerald-950 text-emerald-300 rounded-md text-[10px]">
                  {totalUsersWithPrizes}
                </span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase">
                  <tr>
                    <th className="py-3 px-4">Όνομα Χρήστη</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Ενεργές Συμμετοχές</th>
                    <th className="py-3 px-4 text-center">Πόντοι Επιβράβευσης</th>
                    <th className="py-3 px-4 text-center">Δώρα που Κέρδισε</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sortedUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        Δεν βρέθηκαν χρήστες με τα κριτήρια που επιλέξατε.
                      </td>
                    </tr>
                  ) : (
                    sortedUsers.map((u) => {
                      const unredeemedCount = (u.prizeHistory || []).filter((p) => !p.isRedeemed).length;
                      const totalPrizesCount = (u.prizeHistory || []).length;
                      const hasUnredeemed = unredeemedCount > 0;
                      const hasPrizes = totalPrizesCount > 0;

                      return (
                        <tr
                          key={u.id}
                          className={`transition ${
                            hasUnredeemed
                              ? 'bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-amber-500'
                              : hasPrizes
                              ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                              : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="py-3 px-4 font-bold text-white">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{u.displayName || u.email?.split('@')[0] || 'Χρήστης'}</span>
                              {hasUnredeemed && (
                                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full shadow-sm animate-pulse">
                                  🎁 ΕΚΚΡΕΜΕΙ ΔΩΡΟ
                                </span>
                              )}
                              {!hasUnredeemed && hasPrizes && (
                                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 font-bold text-[10px] rounded-full border border-emerald-500/30">
                                  🏆 ΝΙΚΗΤΗΣ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{u.email || 'N/A'}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 font-extrabold rounded-full border border-amber-500/30">
                              {u.totalMonthlyEntries || 0} 🎟️
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 font-extrabold rounded-full border border-emerald-500/30">
                              🎯 {u.rewardPoints || 0}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-400 font-semibold">
                            {!u.prizeHistory || u.prizeHistory.length === 0 ? (
                              <span className="text-slate-500 text-xs">-</span>
                            ) : (
                              <div className="space-y-1.5 flex flex-col items-center">
                                {u.prizeHistory.map((prize, idx) => {
                                  const prizeId = prize.id || `prize_${idx}`;
                                  return (
                                    <div
                                      key={prizeId}
                                      className={`flex items-center gap-2 px-2.5 py-1 rounded-xl border transition ${
                                        prize.isRedeemed
                                          ? 'bg-slate-950/80 border-slate-800'
                                          : 'bg-amber-950/50 border-amber-500/60 shadow-sm'
                                      }`}
                                    >
                                      <span
                                        className={`text-[11px] font-bold ${
                                          prize.isRedeemed ? 'text-slate-400 line-through' : 'text-amber-400'
                                        }`}
                                      >
                                        {prize.prizeName}
                                      </span>
                                      <button
                                        onClick={() => togglePrizeRedeemed(u.id, prizeId, prize.isRedeemed)}
                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                                          prize.isRedeemed
                                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                                            : 'bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400 font-black shadow'
                                        }`}
                                      >
                                        {prize.isRedeemed ? '✅ Εξαργυρώθηκε' : '⚡ Εξαργύρωση'}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subtab: Raffle */}
        {adminSubTab === 'raffle' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6 text-center max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-amber-500/20 text-amber-400 rounded-3xl flex items-center justify-center mx-auto border border-amber-500/30 text-4xl">
              🎲
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Κλήρωση 15ημέρου (6 Νικητές)</h2>
              <p className="text-xs text-slate-400 mt-1">
                1ος 1 Ζευγάρι Γυαλιά Ηλίου | 2ος TWS Wireless Earbuds | 3ος HOCO W35 Silver Bluetooth | 4ος & 5ος NOD Soundtube TWS Earphones | 6ος HOCO W35 MAX Blue Bluetooth
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-around">
              <div>
                <p className="text-xs font-semibold text-slate-500">ΕΠΙΛΕΞΙΜΟΙ ΧΡΗΣΤΕΣ</p>
                <p className="text-2xl font-black text-white mt-1">
                  {usersList.filter((u) => (u.totalMonthlyEntries || 0) > 0).length}
                </p>
              </div>
              <div className="w-px h-8 bg-slate-800"></div>
              <div>
                <p className="text-xs font-semibold text-slate-500">ΣΥΝΟΛΙΚΟΙ ΛΑΧΝΟΙ</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{totalActiveRaffleTickets}</p>
              </div>
              <div className="w-px h-8 bg-slate-800"></div>
              <div>
                <p className="text-xs font-semibold text-slate-500">ΣΥΝΟΛΙΚΟΙ ΝΙΚΗΤΕΣ</p>
                <p className="text-2xl font-black text-emerald-400 mt-1">6</p>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRunRaffle}
                disabled={actionLoading}
                className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-lg rounded-2xl shadow-xl transition"
              >
                {actionLoading
                  ? '🔄 Διεξαγωγή & Μηδενισμός...'
                  : '🎉 ΔΙΕΞΑΓΩΓΗ ΚΛΗΡΩΣΗΣ 15ΗΜΕΡΟΥ (6 ΝΙΚΗΤΕΣ) & ΜΗΔΕΝΙΣΜΟΣ'}
              </button>

              <button
                onClick={handleManualResetCycle}
                disabled={actionLoading}
                className="w-full py-3 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-2xl transition"
              >
                🔄 Χειροκίνητος Ολικός Μηδενισμός Κύκλου (Καφέδες POS, QR, Λαχνοί)
              </button>
            </div>

            {drawResults && (
              <div className="p-6 bg-slate-950 border border-emerald-500/40 rounded-3xl text-left space-y-4 animate-in fade-in duration-300">
                <h3 className="text-lg font-black text-emerald-400 text-center">
                  🎉 ΑΠΟΤΕΛΕΣΜΑΤΑ ΚΛΗΡΩΣΗΣ (6 ΝΙΚΗΤΕΣ)!
                </h3>
                <div className="space-y-2">
                  {drawResults.map((r, idx) => (
                    <div
                      key={r.id || idx}
                      className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs font-bold text-amber-400">{r.prize}</p>
                        <p className="text-sm font-bold text-white">{r.displayName || r.email}</p>
                        <p className="text-[11px] text-slate-400">📧 {r.email}</p>
                      </div>
                      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full border border-emerald-500/30">
                        {r.totalMonthlyEntries} Λαχνοί
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

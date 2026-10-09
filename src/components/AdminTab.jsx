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
      const history = (user.prizeHistory || []).map((p) => {
        if (p.id === prizeId) {
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
        '🕶️ 2ος Νικητής: 1 Ζευγάρι Γυαλιά Ηλίου',
        '🎧 3ος Νικητής: HOCO BLUETOOTH W35',
        '🔋 4ος Νικητής: ENERGENIE 20W FAST CHARGING POWERBANK 20000 mAh',
        '🔋 5ος Νικητής: GEMBIRD SOLAR POWERBANK 10000 mAh',
        '🔋 6ος Νικητής: POWERBANK ANKER ZOLO 10000mAh'
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

      setDrawResults(drawn);
      alert('🎉 Η κλήρωση ολοκληρώθηκε επιτυχώς!');
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
        'ΠΡΟΣΟΧΗ: Θέλετε να μηδενίσετε χειροκίνητα όλες τις συμμετοχές των χρηστών για τον νέο κύκλο;'
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
      alert('✅ Ο κύκλος συμμετοχών μηδενίστηκε επιτυχώς!');
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

  const filteredUsers = usersList.filter((u) => {
    const q = searchTerm.toLowerCase();
    const name = (u.displayName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return name.includes(q) || email.includes(q);
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block mb-1">Χρήστες</span>
            <span className="text-2xl font-black text-white">{usersList.length}</span>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block mb-1">Συμμετοχές (Λαχνοί)</span>
            <span className="text-2xl font-black text-amber-400">{totalActiveRaffleTickets}</span>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block mb-1">Σκαναρισμένα QR</span>
            <span className="text-2xl font-black text-cyan-400">{qrTokensList.length}</span>
          </div>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
            <span className="text-xs font-semibold text-slate-400 block mb-1">Καφέδες POS</span>
            <span className="text-2xl font-black text-emerald-400">{posCoffees ?? 'N/A'}</span>
          </div>
        </div>

        {/* Subtabs navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button
            onClick={() => setAdminSubTab('winners')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              adminSubTab === 'winners'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            🏆 Νικητές ({winnersList.length})
          </button>
          <button
            onClick={() => setAdminSubTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              adminSubTab === 'users'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            👥 Χρήστες ({usersList.length})
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
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🏆</span>
              <span>Λίστα Νικητών & Εξαργυρώσεων</span>
            </h2>
            <div className="space-y-2">
              {winnersList.map((w) => (
                <div
                  key={w.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between"
                >
                  <div>
                    <p className="font-extrabold text-white text-sm">{w.username || w.email}</p>
                    <p className="text-xs font-bold text-amber-400">{w.prizeWon}</p>
                    {w.drawDateFormatted && (
                      <p className="text-[10px] text-slate-500">🗓️ {w.drawDateFormatted}</p>
                    )}
                  </div>
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-lg border border-amber-500/30">
                    {w.rank ? `#${w.rank}` : '1+1'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subtab: Users */}
        {adminSubTab === 'users' && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>👥</span>
                <span>Λίστα Εγγεγραμμένων Χρηστών ({usersList.length})</span>
              </h2>
              <input
                type="text"
                placeholder="🔍 Αναζήτηση με όνομα ή email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-200 focus:outline-none focus:border-amber-500 w-full sm:w-64"
              />
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
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-bold text-white">
                        {u.displayName || u.email?.split('@')[0] || 'Χρήστης'}
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
                          <span className="text-slate-500 text-xs">0 δώρα</span>
                        ) : (
                          <div className="space-y-1.5 flex flex-col items-center">
                            {u.prizeHistory.map((prize, idx) => (
                              <div
                                key={prize.id || idx}
                                className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-xl border border-slate-800"
                              >
                                <span className="text-[11px] font-bold text-amber-400">
                                  {prize.prizeName}
                                </span>
                                <button
                                  onClick={() => togglePrizeRedeemed(u.id, prize.id, prize.isRedeemed)}
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                                    prize.isRedeemed
                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30'
                                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30'
                                  }`}
                                >
                                  {prize.isRedeemed ? '✅ Εξαργυρώθηκε' : '⏳ Εξαργύρωση'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
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
                1ος & 2ος 1 Ζευγάρι Γυαλιά Ηλίου | 3ος HOCO BLUETOOTH W35 | 4ος ENERGENIE 20000 mAh | 5ος GEMBIRD SOLAR 10000 mAh | 6ος ANKER ZOLO 10000mAh
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

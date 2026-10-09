import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export default function LeaderboardTab() {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'weekly_winners'),
      orderBy('timestampMillis', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));

        list.sort((a, b) => {
          const timeA = a.timestampMillis || 0;
          const timeB = b.timestampMillis || 0;
          if (Math.abs(timeA - timeB) > 60000) {
            return timeB - timeA;
          }
          return (a.rank || 0) - (b.rank || 0);
        });

        setWinners(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching leaderboard:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const getRankBadgeClass = (rank) => {
    switch (rank) {
      case 1:
        return 'bg-amber-400 text-slate-950 border-amber-300 font-black shadow-md shadow-amber-500/20';
      case 2:
        return 'bg-purple-500 text-white border-purple-400 font-black shadow-md shadow-purple-500/20';
      case 3:
        return 'bg-cyan-500 text-slate-950 border-cyan-400 font-black shadow-md shadow-cyan-500/20';
      default:
        return 'bg-slate-800 text-emerald-400 border-slate-700 font-bold';
    }
  };

  const getRankLabel = (rank) => {
    switch (rank) {
      case 1:
        return '🎧 #1';
      case 2:
        return '⌨️ #2';
      case 3:
        return '🔋 #3';
      default:
        return `☕ #${rank || '?'}`;
    }
  };

  const formatDrawDate = (item) => {
    if (item.drawDateFormatted) return item.drawDateFormatted;
    if (item.timestampMillis) {
      return new Date(item.timestampMillis).toLocaleDateString('el-GR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-24 max-w-md mx-auto">
      <div className="flex items-center gap-3 my-4">
        <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center text-xl border border-amber-500/30">
          🏆
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Νικητές Μεγάλης Κλήρωσης</h1>
          <p className="text-xs text-slate-400">Αποτελέσματα κληρώσεων κατά σειρά διεξαγωγής</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : winners.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center my-6">
          <p className="text-sm font-medium text-slate-400">
            Δεν υπάρχουν νικητές ακόμα. Σκανάρετε τους καφέδες σας για να μπείτε στη Μεγάλη Κλήρωση! ☕
          </p>
        </div>
      ) : (
        <div className="space-y-3 mt-6">
          {winners.map((item) => (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                item.rank === 1
                  ? 'bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/10 border-amber-500/40 shadow-xl'
                  : item.rank === 2
                  ? 'bg-gradient-to-r from-purple-500/15 via-slate-900 to-purple-500/10 border-purple-500/30 shadow-lg'
                  : item.rank === 3
                  ? 'bg-gradient-to-r from-cyan-500/15 via-slate-900 to-cyan-500/10 border-cyan-500/30 shadow-lg'
                  : 'bg-slate-900/60 border-slate-800/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`px-2.5 py-1.5 rounded-xl flex items-center justify-center text-xs border shrink-0 ${getRankBadgeClass(
                    item.rank
                  )}`}
                >
                  {getRankLabel(item.rank)}
                </div>
                <div>
                  <h3 className="font-extrabold text-white text-sm">
                    {item.maskedUsername || item.username || 'Νικητής'}
                  </h3>
                  <p className="text-xs font-bold text-amber-400">{item.prizeWon || 'Δώρο Κλήρωσης'}</p>
                </div>
              </div>
              <div className="text-right shrink-0 ml-2">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  🗓️ {formatDrawDate(item)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

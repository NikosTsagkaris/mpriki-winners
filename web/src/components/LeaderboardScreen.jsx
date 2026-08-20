import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import AdBanner from './AdBanner';

export default function LeaderboardScreen() {
  const [winners, setWinners] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'weekly_winners'),
      orderBy('timestampMillis', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc, idx) => ({
        id: doc.id,
        rank: idx + 1,
        ...doc.data()
      }));
      setWinners(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching leaderboard:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getBadgeStyle = (rank) => {
    switch (rank) {
      case 1: return 'bg-amber-400 text-slate-950 border-amber-300';
      case 2: return 'bg-slate-300 text-slate-950 border-slate-200';
      case 3: return 'bg-amber-700 text-amber-100 border-amber-600';
      default: return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const formatRelativeTime = (timestampMillis) => {
    if (!timestampMillis) return '';
    const diff = Math.floor((Date.now() - timestampMillis) / 1000);
    if (diff < 60) return 'μόλις τώρα';
    if (diff < 3600) return `πριν ${Math.floor(diff / 60)}λ`;
    if (diff < 86400) return `πριν ${Math.floor(diff / 3600)}ώ`;
    return `πριν ${Math.floor(diff / 86400)}ημ`;
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 my-4">
        <div className="w-10 h-10 bg-amber-500/20 text-amber-400 rounded-xl flex items-center justify-center text-xl border border-amber-500/30">
          🏆
        </div>
        <div>
          <h1 className="text-xl font-black text-white">Εβδομαδιαίοι Νικητές</h1>
          <p className="text-xs text-slate-400">Ενημερώσεις νικητών σε πραγματικό χρόνο</p>
        </div>
      </div>

      {/* Ad Banner Header */}
      <AdBanner 
        type="adsense"
        adClient="ca-pub-4089447801006214"
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : winners.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center my-6">
          <p className="text-sm font-medium text-slate-400">
            Δεν υπάρχουν νικητές ακόμα αυτή την εβδομάδα. Σκανάρετε πρώτοι!
          </p>
        </div>
      ) : (
        <div className="space-y-3 mt-6">
          {winners.map((entry) => (
            <div
              key={entry.id}
              className={`p-4 rounded-2xl border flex items-center justify-between transition ${
                entry.rank <= 3
                  ? 'bg-slate-900/90 border-slate-800 shadow-lg'
                  : 'bg-slate-900/50 border-slate-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border ${getBadgeStyle(
                    entry.rank
                  )}`}
                >
                  #{entry.rank}
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">{entry.maskedUsername || entry.username || 'Νικητής'}</h3>
                  <p className="text-xs font-semibold text-amber-400">{entry.prizeWon || '1+1 Καφές'}</p>
                </div>
              </div>

              <span className="text-xs text-slate-500 font-medium">
                {formatRelativeTime(entry.timestampMillis)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

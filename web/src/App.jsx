import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import AuthScreen from './components/AuthScreen';
import ScannerScreen from './components/ScannerScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import ProfileScreen from './components/ProfileScreen';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('scanner'); // 'scanner' | 'leaderboard' | 'profile'

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Error signing out:", e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Active Tab Screen Content */}
      <main className="flex-1">
        {currentTab === 'scanner' && <ScannerScreen />}
        {currentTab === 'leaderboard' && <LeaderboardScreen />}
        {currentTab === 'profile' && <ProfileScreen onSignOut={handleSignOut} />}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur border-t border-slate-800 py-2">
        <div className="max-w-md mx-auto flex items-center justify-around">
          <button
            onClick={() => setCurrentTab('scanner')}
            className={`flex flex-col items-center gap-1 text-xs font-semibold py-1 px-4 rounded-2xl transition ${
              currentTab === 'scanner' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-xl">📷</span>
            <span>Σκανάρισμα</span>
          </button>

          <button
            onClick={() => setCurrentTab('leaderboard')}
            className={`flex flex-col items-center gap-1 text-xs font-semibold py-1 px-4 rounded-2xl transition ${
              currentTab === 'leaderboard' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-xl">🏆</span>
            <span>Νικητές</span>
          </button>

          <button
            onClick={() => setCurrentTab('profile')}
            className={`flex flex-col items-center gap-1 text-xs font-semibold py-1 px-4 rounded-2xl transition ${
              currentTab === 'profile' ? 'text-amber-400 bg-amber-500/10' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <span className="text-xl">👤</span>
            <span>Προφίλ</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { getNextDrawTimeMillis } from '../utils/monthlyDrawSchedule';

export default function AuthScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const ensureUserDocExists = async (user) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          totalMonthlyEntries: 0,
          nextDrawTimeMillis: getNextDrawTimeMillis(),
          prizeHistory: []
        }, { merge: true });
      }
    } catch (e) {
      console.error("Error creating user doc:", e);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError('Παρακαλώ συμπληρώστε το email και τον κωδικό πρόσβασης.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUserDocExists(res.user);
      } else {
        const res = await signInWithEmailAndPassword(auth, email, password);
        await ensureUserDocExists(res.user);
      }
    } catch (err) {
      console.error(err);
      setError(err.message.includes('auth/invalid-credential') 
        ? 'Λανθασμένο email ή κωδικός πρόσβασης.' 
        : err.message.includes('auth/email-already-in-use')
        ? 'Το email χρησιμοποιείται ήδη.'
        : 'Αποτυχία σύνδεσης. Παρακαλώ δοκιμάστε ξανά.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      await ensureUserDocExists(res.user);
    } catch (err) {
      console.error("Google Auth error:", err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('Η σύνδεση ακυρώθηκε από τον χρήστη.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setError('Το domain δεν είναι εξουσιοδοτημένο στο Firebase Console.');
      } else {
        setError(err.message || 'Αποτυχία σύνδεσης με Google.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30 text-3xl">
            ☕
          </div>
          <h1 className="text-2xl font-extrabold text-white">Mpriki Winners</h1>
          <p className="text-sm text-slate-400 mt-1">Σκανάρετε QR codes & κερδίστε δώρα!</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-2xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Κωδικός Πρόσβασης</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            {loading ? 'Παρακαλώ περιμένετε...' : isSignUp ? 'Εγγραφή' : 'Σύνδεση'}
          </button>
        </form>

        <div className="my-6 flex items-center justify-between text-xs text-slate-600 uppercase font-semibold">
          <span className="h-px bg-slate-800 flex-1"></span>
          <span className="px-3">ή</span>
          <span className="h-px bg-slate-800 flex-1"></span>
        </div>

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full py-3.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-semibold rounded-2xl flex items-center justify-center gap-3 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"/>
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"/>
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z"/>
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"/>
          </svg>
          Συνέχεια με Google
        </button>

        <div className="mt-8 text-center">
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-sm font-medium text-slate-400 hover:text-amber-400 transition"
          >
            {isSignUp ? 'Έχετε ήδη λογαριασμό; Σύνδεση' : 'Δεν έχετε λογαριασμό; Εγγραφή'}
          </button>
        </div>
      </div>
    </div>
  );
}

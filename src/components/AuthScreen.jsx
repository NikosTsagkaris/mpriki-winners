import React, { useState } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup 
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider, getNextDrawTime } from '../firebase';

export default function AuthScreen() {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const syncUserDoc = async (user) => {
    try {
      const userRef = doc(db, 'users', user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          totalMonthlyEntries: 0,
          rewardPoints: 0,
          nextDrawTimeMillis: getNextDrawTime(),
          prizeHistory: []
        }, { merge: true });
      }
    } catch (err) {
      console.error('Error creating user doc:', err);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email || !password) {
      setErrorMessage('Παρακαλώ συμπληρώστε το email και τον κωδικό πρόσβασης.');
      return;
    }

    if (isRegister && !acceptTerms) {
      setErrorMessage('Παρακαλώ αποδεχτείτε τους Όρους Χρήσης & την Πολιτική Απορρήτου (18+).');
      return;
    }

    setLoading(true);
    try {
      if (isRegister) {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await syncUserDoc(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await syncUserDoc(cred.user);
      }
    } catch (err) {
      console.error('Email Auth error:', err);
      if (err.message?.includes('auth/invalid-credential')) {
        setErrorMessage('Λανθασμένο email ή κωδικός πρόσβασης.');
      } else if (err.message?.includes('auth/email-already-in-use')) {
        setErrorMessage('Το email χρησιμοποιείται ήδη.');
      } else {
        setErrorMessage('Αποτυχία σύνδεσης. Παρακαλώ δοκιμάστε ξανά.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setErrorMessage('');
    if (isRegister && !acceptTerms) {
      setErrorMessage('Παρακαλώ αποδεχτείτε τους Όρους Χρήσης & την Πολιτική Απορρήτου (18+).');
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await syncUserDoc(cred.user);
    } catch (err) {
      console.error('Google Auth error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setErrorMessage('Η σύνδεση ακυρώθηκε από τον χρήστη.');
      } else if (err.code === 'auth/unauthorized-domain') {
        setErrorMessage('Το domain δεν είναι εξουσιοδοτημένο στο Firebase Console.');
      } else {
        setErrorMessage(err.message || 'Αποτυχία σύνδεσης με Google.');
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

        {errorMessage && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm rounded-2xl text-center">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Email
            </label>
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
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Κωδικός Πρόσβασης
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition"
              required
            />
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400 select-none">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-500 focus:ring-offset-slate-900"
              />
              <span>
                Έχω διαβάσει και αποδέχομαι τους{' '}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowTerms(!showTerms);
                  }}
                  className="text-amber-400 font-semibold underline hover:text-amber-300"
                >
                  Όρους Χρήσης & Πολιτική Απορρήτου (18+)
                </button>
              </span>
            </label>
          </div>

          {showTerms && (
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl text-[11px] text-slate-400 space-y-2 max-h-48 overflow-y-auto">
              <h5 className="font-bold text-amber-400">📄 Συνοπτικοί Όροι Χρήσης & Απορρήτου</h5>
              <p>
                • <strong>GDPR:</strong> Τα δεδομένα σας (email, σαρώσεις, δώρα) χρησιμοποιούνται αποκλειστικά για το πρόγραμμα επιβράβευσης Mpriki.
              </p>
              <p>
                • <strong>Local Storage:</strong> Η εφαρμογή χρησιμοποιεί μόνο τεχνικώς απαραίτητη τοπική αποθήκευση (Firebase Login). Δεν χρησιμοποιούνται διαφημιστικά cookies.
              </p>
              <p>
                • <strong>1 Δώρο ανά Νικητή:</strong> Κάθε χρήστης μπορεί να αναδειχθεί νικητής σε 1 μόνο δώρο ανά 15νθήμερη κλήρωση.
              </p>
              <p>
                • <strong>Διάρκεια 10 Ημερών:</strong> Τα δώρα λήγουν αυτόματα σε 10 ημέρες από την απόκτησή τους.
              </p>
              <p>
                • <strong>Διαγραφή:</strong> Αίτημα διαγραφής στο info@ntvelop.gr.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            {loading ? 'Παρακαλώ περιμένετε...' : isRegister ? 'Εγγραφή' : 'Σύνδεση'}
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
            <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z" />
            <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z" />
            <path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9c-.2-.7-.4-1.5-.4-2.3z" />
            <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z" />
          </svg>
          Συνέχεια με Google
        </button>

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMessage('');
            }}
            className="text-sm font-medium text-slate-400 hover:text-amber-400 transition"
          >
            {isRegister ? 'Έχετε ήδη λογαριασμό; Σύνδεση' : 'Δεν έχετε λογαριασμό; Εγγραφή'}
          </button>
        </div>
      </div>
    </div>
  );
}

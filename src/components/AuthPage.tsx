import { useState } from 'react';

interface Props {
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (email: string, password: string) => Promise<void>;
  onGoogleSignIn: () => Promise<void>;
}

export default function AuthPage({ onSignIn, onSignUp, onGoogleSignIn }: Props) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (isSignUp) {
        await onSignUp(email, password);
        setSuccess('Check your email to confirm your account.');
      } else {
        await onSignIn(email, password);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-bg-primary flex items-center justify-center z-200">
      <div className="bg-bg-card border border-border-secondary rounded-2xl p-10 max-w-[440px] w-full text-center">
        <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">GanttSmart</h1>
        <p className="text-[13px] text-text-secondary mb-8 leading-relaxed">
          {isSignUp ? 'Create an account to get started' : 'Sign in to your account'}
        </p>

        {/* Google OAuth */}
        <button
          onClick={async () => {
            setBusy(true);
            setError('');
            try { await onGoogleSignIn(); } catch (err) { setError((err as Error).message); }
            setBusy(false);
          }}
          disabled={busy}
          className="w-full py-3 px-4 bg-white text-gray-800 rounded-lg text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 hover:bg-gray-100 transition-colors mb-6 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border-secondary" />
          <span className="text-[11px] text-text-muted uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-border-secondary" />
        </div>

        {/* Email/Password form */}
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            autoComplete="email"
            className="w-full px-4 py-3 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-sm mb-3 outline-none transition-colors focus:border-accent"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            className="w-full px-4 py-3 bg-bg-primary border border-border-secondary rounded-lg text-text-primary text-sm mb-4 outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full py-3 bg-success border-none rounded-lg text-white text-sm font-semibold cursor-pointer transition-colors hover:bg-success-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        {error && <div className="text-urgent text-xs mt-3">{error}</div>}
        {success && <div className="text-success text-xs mt-3">{success}</div>}

        <p className="text-xs text-text-muted mt-6">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
            className="text-accent hover:underline cursor-pointer"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}

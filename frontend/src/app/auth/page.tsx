'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { signIn } from 'next-auth/react';
import ThemeToggle from '@/components/ThemeToggle';
import { MusicNote } from 'phosphor-react';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authStatus } = useStore();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [guestName, setGuestName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const redirectAfterAuth = () => {
    const raw = sessionStorage.getItem('postAuthAction');
    if (!raw) {
      router.push('/');
      return;
    }
    sessionStorage.removeItem('postAuthAction');
    try {
      const action = JSON.parse(raw) as { type?: string };
      if (action.type === 'lobby') {
        router.push('/lobby');
        return;
      }
      router.push('/');
    } catch {
      router.push('/');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        mode: isLogin ? 'login' : 'register',
        username,
        password,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      redirectAfterAuth();
    } catch (err: any) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setGuestLoading(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        mode: 'guest',
        username: guestName,
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      redirectAfterAuth();
    } catch (err: any) {
      setError(err?.message || 'Guest sign-in failed');
    } finally {
      setGuestLoading(false);
    }
  };

  const isAuthLoading = authStatus === 'loading';

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (!mode) return;
    if (mode === 'register') {
      setIsLogin(false);
    } else if (mode === 'login') {
      setIsLogin(true);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2" style={{ color: 'var(--primary)' }}>
            <span className="inline-flex items-center gap-3">
              <MusicNote size={32} weight="duotone" />
              Music Mayhem
            </span>
          </h1>
          <p className="opacity-80">
            {isLogin ? 'Welcome back!' : 'Create your account'}
          </p>
        </div>

        <div className="card">
          <div className="flex gap-4 mb-6">
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`flex-1 py-2 font-semibold rounded-md transition-all ${
                isLogin ? 'btn' : 'opacity-50 hover:opacity-75'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`flex-1 py-2 font-semibold rounded-md transition-all ${
                !isLogin ? 'btn' : 'opacity-50 hover:opacity-75'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-2 font-semibold">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input"
                placeholder="Enter username"
                required
                minLength={3}
                maxLength={20}
                disabled={isAuthLoading || loading}
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter password"
                required
                minLength={6}
                disabled={isAuthLoading || loading}
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-500 bg-opacity-20 text-red-500 border border-red-500">
                {error}
              </div>
            )}

            <button type="submit" className="btn w-full" disabled={loading || isAuthLoading}>
              {loading ? 'Processing...' : isLogin ? 'Login' : 'Register'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 opacity-60">
            <div className="h-px bg-current flex-1" />
            <span className="text-xs uppercase tracking-widest">or</span>
            <div className="h-px bg-current flex-1" />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2">Continue as Guest</h3>
            <p className="text-sm opacity-70 mb-4">
              Pick a display name. You can still play, but your guest account is temporary.
            </p>
            <form onSubmit={handleGuestSubmit} className="space-y-3">
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="input"
                placeholder="Guest name"
                minLength={2}
                maxLength={20}
                required
                disabled={guestLoading || isAuthLoading}
              />
              <button type="submit" className="btn-secondary w-full" disabled={guestLoading || isAuthLoading}>
                {guestLoading ? 'Joining...' : 'Continue as Guest'}
              </button>
            </form>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push('/')}
              className="text-sm opacity-60 hover:opacity-100 transition-opacity"
            >
              ← Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}

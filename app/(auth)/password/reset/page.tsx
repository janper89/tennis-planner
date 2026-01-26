'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function PasswordResetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const supabase = createClient();

  useEffect(() => {
    // Check for recovery token immediately on mount
    const checkRecovery = () => {
      // Check hash fragment (Supabase default)
      const hash = window.location.hash;
      console.log('🔍 Checking for recovery token. Hash:', hash);
      console.log('🔍 Full URL:', window.location.href);
      
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const type = params.get('type');
        console.log('🔍 Type from hash:', type);
        if (type === 'recovery') {
          console.log('✅ Recovery token found in hash, setting step to reset');
          setStep('reset');
          return true;
        }
      }
      
      // Check query params
      try {
        const queryType = searchParams.get('type');
        console.log('🔍 Type from query params:', queryType);
        if (queryType === 'recovery') {
          console.log('✅ Recovery token found in query params, setting step to reset');
          setStep('reset');
          return true;
        }
      } catch (e) {
        // searchParams might not be available yet
        console.log('🔍 searchParams not available yet');
      }
      
      console.log('❌ No recovery token found');
      return false;
    };

    // Check immediately
    const hasRecovery = checkRecovery();
    
    if (hasRecovery) {
      // If recovery found, wait for Supabase to process it
      setTimeout(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔍 Session check after recovery:', session ? 'exists' : 'none');
        if (session) {
          console.log('✅ Session exists, ready for password reset');
        }
      }, 1000);
    }

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔔 Auth event:', event, session ? 'has session' : 'no session');
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('✅ PASSWORD_RECOVERY event - setting step to reset');
        setStep('reset');
      } else if (event === 'SIGNED_IN' && session) {
        // Check if we have recovery hash
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
          console.log('✅ SIGNED_IN with recovery hash - setting step to reset');
          setStep('reset');
          window.history.replaceState(null, '', window.location.pathname);
        } else if (window.location.pathname === '/password/reset') {
          // If we're on reset page and have session, might be recovery
          console.log('✅ SIGNED_IN on reset page - setting step to reset');
          setStep('reset');
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Use current origin (localhost in dev, vercel in prod)
      const redirectUrl = `${window.location.origin}/password/reset`;
      console.log('🔍 Sending reset email with redirect URL:', redirectUrl);
      
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: redirectUrl,
        }
      );

      if (resetError) {
        setError(resetError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error('Password reset error:', err);
      setError('Došlo k chybě při odesílání emailu');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError('Hesla se neshodují');
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      setError('Heslo musí mít alespoň 6 znaků');
      return;
    }

    // Check if we have a session (required for password reset)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setError('Session vypršela. Požádej znovu o reset hesla.');
      setStep('request');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setNewPassword('');
      setConfirmPassword('');

      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err) {
      console.error('Password reset error:', err);
      setError('Došlo k chybě při resetování hesla');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <svg
              className="h-8 w-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {step === 'request' ? 'Reset hesla' : 'Nastavit nové heslo'}
          </h1>
          <p className="mt-2 text-gray-600">
            {step === 'request'
              ? 'Zadej svůj email a pošleme ti odkaz na reset hesla'
              : 'Zadej nové heslo'}
          </p>
        </div>

        {step === 'request' ? (
          <form onSubmit={handleRequestReset} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
                Email s odkazem na reset hesla byl odeslán. Zkontroluj svou
                emailovou schránku.
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="vas@email.cz"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Odesílám...' : 'Odeslat odkaz na reset hesla'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="mt-8 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
                Heslo bylo úspěšně změněno! Přesměrování na přihlášení...
              </div>
            )}

            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Nové heslo
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Minimálně 6 znaků"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-medium text-gray-700"
              >
                Potvrdit nové heslo
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                placeholder="Zopakujte nové heslo"
              />
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Nastavuji...' : 'Nastavit nové heslo'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-gray-500">
          <Link
            href="/login"
            className="text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Zpět na přihlášení
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function PasswordResetPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100">
        <div className="text-center">
          <p className="text-gray-600">Načítání...</p>
        </div>
      </div>
    }>
      <PasswordResetContent />
    </Suspense>
  );
}

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
  const [linkExpired, setLinkExpired] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const errorCode = params.get('error_code') ?? params.get('error');
      const code = params.get('code');
      if (errorCode === 'otp_expired' || code === '403' || params.get('error_description')?.includes('expired')) {
        setLinkExpired(true);
        setStep('request');
        window.history.replaceState(null, '', window.location.pathname);
        return;
      }
      const type = params.get('type');
      if (type === 'recovery') {
        setStep('reset');
        return;
      }
    }
    const checkRecovery = () => {
      try {
        const queryType = searchParams.get('type');
        if (queryType === 'recovery') {
          setStep('reset');
          return true;
        }
      } catch {
        // searchParams might not be available yet
      }
      return false;
    };
    checkRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStep('reset');
      } else if (event === 'SIGNED_IN' && session) {
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
          setStep('reset');
          window.history.replaceState(null, '', window.location.pathname);
        } else if (window.location.pathname === '/password/reset') {
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
      const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL}/password/reset`
        : `${window.location.origin}/password/reset`;
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
            {linkExpired && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800">
                <p className="font-medium">Odkaz vypršel nebo byl již použit.</p>
                <p className="mt-1">Odkaz na reset hesla platí jen omezenou dobu (obvykle 1 hodinu) a lze ho použít jen jednou. Zadej e‑mail níže a pošleme ti nový odkaz.</p>
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="space-y-2 rounded-lg bg-green-50 p-4 text-sm text-green-700">
                <p>Email s odkazem na reset hesla byl odeslán. Zkontroluj svou emailovou schránku.</p>
                <p className="text-green-600">
                  Nepřišel? Zkontroluj <strong>spam</strong>. V Supabase Dashboard musí být v Authentication → URL Configuration → Redirect URLs adresa{' '}
                  <code className="rounded bg-green-100 px-1">{typeof window !== 'undefined' ? window.location.origin : ''}/password/reset</code>.
                </p>
                <p className="mt-2 text-green-700">
                  Doručení může trvat několik minut. Zkontrolujte také složku spam. Pokud email nedorazí do 5 minut, kontaktujte nás.
                </p>
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

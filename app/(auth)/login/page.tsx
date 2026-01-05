'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ROLE_REDIRECTS, type UserRole } from '@/lib/config';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Sign in with email and password
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        if (authError.message === 'Invalid login credentials') {
          setError('Nesprávný email nebo heslo');
        } else {
          setError(authError.message);
        }
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Přihlášení se nezdařilo');
        setLoading(false);
        return;
      }

      const userEmail = authData.user.email!;

      // Try RPC function first (if it exists), otherwise fall back to direct query
      const trimmedEmail = userEmail.trim();
      
      let role: UserRole | null = null;
      
      // Try RPC function
      const { data: rpcRole, error: rpcError } = await supabase.rpc('get_user_role_by_email', {
        user_email: trimmedEmail
      });
      
      if (!rpcError && rpcRole) {
        role = rpcRole as UserRole;
      } else {
        // Fall back to direct query
        console.log('RPC failed, trying direct query. RPC error:', rpcError);
        const { data: appUsers, error: userError } = await supabase
          .from('app_user')
          .select('role, email, id')
          .eq('email', trimmedEmail);

        console.log('Direct query result:', { appUsers, userError });
        
        if (userError) {
          console.error('Error fetching user role:', userError);
          setError(`Chyba při načítání role: ${userError.message}. Zkontroluj konzoli prohlížeče (F12).`);
          setLoading(false);
          return;
        }

        if (!appUsers || appUsers.length === 0) {
          console.error('No users found for email:', trimmedEmail);
          setError(`Uživatel s emailem ${trimmedEmail} nemá přiřazenou roli v databázi. Zkontroluj, zda je záznam v tabulce app_user.`);
          setLoading(false);
          return;
        }

        if (appUsers.length > 1) {
          console.error('Multiple users found with same email:', appUsers);
          setError(`V databázi je více záznamů se stejným emailem. Kontaktujte administrátora.`);
          setLoading(false);
          return;
        }

        role = appUsers[0].role as UserRole;
      }
      
      if (!role) {
        setError(`Nepodařilo se získat roli uživatele.`);
        setLoading(false);
        return;
      }

      // Redirect based on role
      const redirectPath = ROLE_REDIRECTS[role] || '/';
      router.push(redirectPath);
    } catch (err) {
      console.error('Login error:', err);
      setError('Došlo k chybě při přihlášení');
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Tenisový klub</h1>
          <p className="mt-2 text-gray-600">Plánování turnajů</p>
        </div>

        <form onSubmit={handleLogin} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
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

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Heslo
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Přihlašování...' : 'Přihlásit se'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          Zapomněli jste heslo? Kontaktujte administrátora klubu.
        </p>
      </div>
    </div>
  );
}

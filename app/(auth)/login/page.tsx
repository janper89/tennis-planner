'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_REDIRECTS, type UserRole } from '@/lib/config';

export default function LoginPage() {
  const router = useRouter();

  // když už mám uloženou roli v localStorage, rovnou přesměruj
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedRole = window.localStorage.getItem('demo_role') as UserRole | null;
    if (storedRole && ROLE_REDIRECTS[storedRole]) {
      router.replace(ROLE_REDIRECTS[storedRole]);
    }
  }, [router]);

  const loginAs = (role: UserRole) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('demo_role', role);
    router.push(ROLE_REDIRECTS[role]);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md">
        <h1 className="text-center text-2xl font-bold text-gray-900">
          Demo přihlášení
        </h1>
        <p className="text-center text-sm text-gray-600">
          Vyber roli, jako kterou se chceš podívat do aplikace.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => loginAs('parent')}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Přihlásit jako Rodič
          </button>
          <button
            onClick={() => loginAs('coach')}
            className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Přihlásit jako Trenér
          </button>
          <button
            onClick={() => loginAs('manager')}
            className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
          >
            Přihlásit jako Manažer (vedení klubu)
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-500">
          (Toto je demo přihlášení – neodesílá žádné e-maily, jen přepíná pohled.)
        </p>
      </div>
    </div>
  );
}
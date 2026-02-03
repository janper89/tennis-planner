'use client';

import { useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_REDIRECTS } from '@/lib/config';
import type { UserRole } from '@/lib/config';

const VALID_ROLES: UserRole[] = ['parent', 'coach', 'manager'];

function getViewRoleSnapshot(): UserRole {
  if (typeof window === 'undefined') return 'manager';
  const saved = localStorage.getItem('viewRole');
  return (saved && VALID_ROLES.includes(saved as UserRole))
    ? (saved as UserRole)
    : 'manager';
}

function getServerSnapshot(): UserRole {
  return 'manager';
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyListeners(): void {
  listeners.forEach((cb) => cb());
}

export default function RoleSwitcher() {
  const viewRole = useSyncExternalStore(subscribe, getViewRoleSnapshot, getServerSnapshot);
  const router = useRouter();

  const handleRoleChange = (role: UserRole) => {
    localStorage.setItem('viewRole', role);
    notifyListeners();
    router.push(ROLE_REDIRECTS[role]);
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white p-1">
      <span className="px-2 text-xs text-gray-600">Zobrazit jako:</span>
      {VALID_ROLES.map((role) => (
        <button
          key={role}
          onClick={() => handleRoleChange(role)}
          className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
            viewRole === role
              ? 'bg-blue-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          {role === 'parent' ? 'Rodič' : role === 'coach' ? 'Trenér' : 'Manažer'}
        </button>
      ))}
    </div>
  );
}

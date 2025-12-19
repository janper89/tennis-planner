'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ROLE_REDIRECTS } from '@/lib/config';
import type { UserRole } from '@/lib/config';

export default function RoleSwitcher() {
  const [viewRole, setViewRole] = useState<UserRole>('manager');
  const router = useRouter();

  useEffect(() => {
    // Load from localStorage
    const saved = localStorage.getItem('viewRole') as UserRole;
    if (saved && ['parent', 'coach', 'manager'].includes(saved)) {
      setViewRole(saved);
    }
  }, []);

  const handleRoleChange = (role: UserRole) => {
    setViewRole(role);
    localStorage.setItem('viewRole', role);
    router.push(ROLE_REDIRECTS[role]);
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-gray-300 bg-white p-1">
      <span className="px-2 text-xs text-gray-600">Zobrazit jako:</span>
      {(['parent', 'coach', 'manager'] as UserRole[]).map((role) => (
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


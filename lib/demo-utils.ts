import type { UserRole } from './config';

// Kontrola, zda je aplikace v demo režimu
export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return !!localStorage.getItem('demo_role');
}

// Získání demo role z localStorage
export function getDemoRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const role = localStorage.getItem('demo_role') as UserRole | null;
  if (role && ['parent', 'coach', 'manager'].includes(role)) {
    return role;
  }
  return null;
}

// Odstranění demo režimu
export function clearDemoMode(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('demo_role');
  localStorage.removeItem('viewRole');
}









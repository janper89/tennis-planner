// Admin emails – přidej sem svůj e-mail
export const ADMIN_EMAILS = [
  'perutka89@gmail.com',
];

export type UserRole = 'parent' | 'coach' | 'manager';

export const ROLE_LABELS: Record<UserRole, string> = {
  parent: 'Rodič',
  coach: 'Trenér',
  manager: 'Manažer',
};

export const ROLE_REDIRECTS: Record<UserRole, string> = {
  parent: '/parent',
  coach: '/coach',
  manager: '/manager',
};
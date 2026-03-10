// Admin emails – přidej sem svůj e-mail (RoleSwitcher, atd.)
export const ADMIN_EMAILS = [
  'perutka89@gmail.com',
];

/** Emaily, které mohou v režimu „Zobrazit jako“ plně editovat (přidávat dítě, turnaje, atd.) */
export const ADMIN_EDIT_EMAILS = [
  'perutka89@gmail.com',
  'al.sprlak@seznam.cz',
];

export type UserRole = 'parent' | 'coach' | 'manager' | 'player';

export const ROLE_LABELS: Record<UserRole, string> = {
  parent: 'Rodič',
  coach: 'Trenér',
  manager: 'Manažer',
  player: 'Hráč',
};

export const ROLE_REDIRECTS: Record<UserRole, string> = {
  parent: '/parent',
  coach: '/coach',
  manager: '/manager',
  player: '/player',
};
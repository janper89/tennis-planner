import type { Database } from '@/types/database';

type Player = Database['public']['Tables']['player']['Row'];
type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'] & {
  tournament: Tournament;
  player: Player;
};

// Demo data pro zobrazení v demo režimu
export const DEMO_PLAYERS: Player[] = [
  {
    id: 'demo-player-1',
    name: 'Jan Novák',
    birth_date: '2010-05-15',
    rocnik: 2010,
    category: 'U14',
    coach_id: 'demo-coach-1',
    parent_id: 'demo-parent-1',
    limit_turnaju: 16,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-player-2',
    name: 'Marie Svobodová',
    birth_date: '2011-08-20',
    rocnik: 2011,
    category: 'U13',
    coach_id: 'demo-coach-1',
    parent_id: 'demo-parent-2',
    limit_turnaju: 16,
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-player-3',
    name: 'Tomáš Dvořák',
    birth_date: '2012-03-10',
    rocnik: 2012,
    category: 'U12',
    coach_id: null,
    parent_id: 'demo-parent-3',
    limit_turnaju: 16,
    created_at: new Date().toISOString(),
  },
];

export const DEMO_TOURNAMENTS: Tournament[] = [
  {
    id: 'demo-tournament-1',
    nazev: 'Mistrovství ČR U14',
    kategorie: 'U14',
    misto: 'Praha',
    datum: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    entry_deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    withdraw_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    poznamka: 'Důležitý turnaj',
    created_by: 'demo-parent-1',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-tournament-2',
    nazev: 'Regionální turnaj',
    kategorie: 'U13',
    misto: 'Brno',
    datum: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    entry_deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    withdraw_deadline: null,
    poznamka: null,
    created_by: 'demo-parent-2',
    created_at: new Date().toISOString(),
  },
  {
    id: 'demo-tournament-3',
    nazev: 'Mladší žáci',
    kategorie: 'U12',
    misto: 'Ostrava',
    datum: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    entry_deadline: null,
    withdraw_deadline: null,
    poznamka: null,
    created_by: 'demo-parent-3',
    created_at: new Date().toISOString(),
  },
];

export const DEMO_ENTRIES: Entry[] = [
  {
    id: 'demo-entry-1',
    player_id: 'demo-player-1',
    tournament_id: 'demo-tournament-1',
    priority: 1,
    status: 'planovano',
    poznamka_rodic: 'Preferovaný turnaj',
    created_at: new Date().toISOString(),
    tournament: DEMO_TOURNAMENTS[0],
    player: DEMO_PLAYERS[0],
  },
  {
    id: 'demo-entry-2',
    player_id: 'demo-player-2',
    tournament_id: 'demo-tournament-2',
    priority: 2,
    status: 'planovano',
    poznamka_rodic: null,
    created_at: new Date().toISOString(),
    tournament: DEMO_TOURNAMENTS[1],
    player: DEMO_PLAYERS[1],
  },
];

export const DEMO_COACHES = [
  { id: 'demo-coach-1', email: 'trener@example.com' },
];

// Funkce pro získání demo dat podle role
export function getDemoDataForRole(role: 'parent' | 'coach' | 'manager') {
  if (role === 'parent') {
    // Rodič vidí pouze své děti
    return {
      players: DEMO_PLAYERS.filter((p) => p.parent_id === 'demo-parent-1'),
      entries: DEMO_ENTRIES.filter((e) => e.player.parent_id === 'demo-parent-1'),
      tournaments: DEMO_TOURNAMENTS.filter((t) =>
        DEMO_ENTRIES.some(
          (e) =>
            e.tournament_id === t.id &&
            e.player.parent_id === 'demo-parent-1'
        )
      ),
    };
  }

  if (role === 'coach') {
    // Trenér vidí pouze své svěřence
    return {
      players: DEMO_PLAYERS.filter((p) => p.coach_id === 'demo-coach-1'),
      entries: DEMO_ENTRIES.filter((e) => e.player.coach_id === 'demo-coach-1'),
      tournaments: DEMO_TOURNAMENTS.filter((t) =>
        DEMO_ENTRIES.some(
          (e) =>
            e.tournament_id === t.id &&
            e.player.coach_id === 'demo-coach-1'
        )
      ),
    };
  }

  // Manager vidí všechno
  return {
    players: DEMO_PLAYERS,
    entries: DEMO_ENTRIES,
    tournaments: DEMO_TOURNAMENTS,
    coaches: DEMO_COACHES,
  };
}









'use client';

import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { Database } from '@/types/database';

type Player = Database['public']['Tables']['player']['Row'];
type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'] & {
  tournament: Tournament;
  player: Player;
};

interface CoachDashboardProps {
  players: Player[];
  entries: Entry[];
  tournaments: Tournament[];
}

export default function CoachDashboard({
  players,
  entries,
  tournaments,
}: CoachDashboardProps) {
  const supabase = createClient();

  const handleLogout = async () => {
    // Check if in demo mode
    if (typeof window !== 'undefined' && window.localStorage.getItem('demo_role')) {
      window.localStorage.removeItem('demo_role');
      window.localStorage.removeItem('viewRole');
      window.location.href = '/login';
      return;
    }
    
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Create a map of player_id -> entries
  const entriesByPlayer = entries.reduce((acc, entry) => {
    if (!acc[entry.player_id]) {
      acc[entry.player_id] = [];
    }
    acc[entry.player_id].push(entry);
    return acc;
  }, {} as Record<string, Entry[]>);

  // Create a map of tournament_id -> entries
  const entriesByTournament = entries.reduce((acc, entry) => {
    if (!acc[entry.tournament_id]) {
      acc[entry.tournament_id] = [];
    }
    acc[entry.tournament_id].push(entry);
    return acc;
  }, {} as Record<string, Entry[]>);

  // Calculate played tournaments for each player
  const getPlayedCount = (playerId: string) => {
    return entriesByPlayer[playerId]?.filter(
      (e) => e.status === 'odehrano'
    ).length || 0;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Tenisový klub - Trenér
            </h1>
            <button
              onClick={handleLogout}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Odhlásit se
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Matrix View */}
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Turnaj
                </th>
                {players.map((player) => (
                  <th
                    key={player.id}
                    className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
                  >
                    <div className="font-semibold">{player.name}</div>
                    <div className="text-xs font-normal text-gray-400">
                      {player.rocnik} • {getPlayedCount(player.id)} /{' '}
                      {player.limit_turnaju}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {tournaments.map((tournament) => {
                const tournamentEntries = entriesByTournament[tournament.id] || [];
                return (
                  <tr key={tournament.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm">
                      <div className="font-medium">{tournament.nazev}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(tournament.datum)} • {tournament.misto}
                      </div>
                    </td>
                    {players.map((player) => {
                      const entry = tournamentEntries.find(
                        (e) => e.player_id === player.id
                      );
                      return (
                        <td
                          key={player.id}
                          className="px-4 py-3 text-center text-sm"
                        >
                          {entry ? (
                            <div className="inline-block rounded-md bg-blue-50 px-2 py-1">
                              <div className="text-xs font-medium text-blue-900">
                                {entry.tournament.misto}
                              </div>
                              <div className="text-xs text-blue-700">
                                {entry.tournament.kategorie}
                              </div>
                              <div className="text-xs font-semibold text-blue-900">
                                P{entry.priority}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {tournaments.length === 0 && (
                <tr>
                  <td
                    colSpan={players.length + 1}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Zatím nejsou žádné turnaje.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {players.map((player) => {
            const playerEntries = entriesByPlayer[player.id] || [];
            const playedCount = getPlayedCount(player.id);
            return (
              <div
                key={player.id}
                className="rounded-lg bg-white p-4 shadow"
              >
                <h3 className="font-semibold">{player.name}</h3>
                <p className="text-sm text-gray-600">
                  Ročník: {player.rocnik} • Kategorie: {player.category || '-'}
                </p>
                <p className="mt-2 text-sm">
                  Turnaje: {playedCount} / {player.limit_turnaju}
                </p>
                <p className="text-sm text-gray-600">
                  Přihlášeno: {playerEntries.length}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}


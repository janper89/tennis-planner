'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { formatDate, getWeekNumber } from '@/lib/utils';
import { ADMIN_EMAILS } from '@/lib/config';
import RoleSwitcher from '@/components/RoleSwitcher';
import type { Database } from '@/types/database';

type Player = Database['public']['Tables']['player']['Row'];
type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'] & {
  tournament: Tournament;
  player: Player;
};
type Coach = {
  id: string;
  email: string;
};

interface ManagerDashboardProps {
  players: Player[];
  coaches: Coach[];
  entries: Entry[];
  tournaments: Tournament[];
}

export default function ManagerDashboard({
  players: initialPlayers,
  coaches,
  entries: initialEntries,
  tournaments: initialTournaments,
}: ManagerDashboardProps) {
  const [players, setPlayers] = useState(initialPlayers);
  const [entries, setEntries] = useState(initialEntries);
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [selectedCoachId, setSelectedCoachId] = useState<string>('all');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Check if user is admin
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email && ADMIN_EMAILS.includes(user.email)) {
        setIsAdmin(true);
      }
    });
  }, []);

  // Filter players by coach
  const filteredPlayers =
    selectedCoachId === 'all'
      ? players
      : players.filter((p) => p.coach_id === selectedCoachId);

  // Filter tournaments by week
  const filteredTournaments =
    selectedWeek === 'all'
      ? tournaments
      : tournaments.filter((t) => {
          const week = getWeekNumber(t.datum);
          return week.toString() === selectedWeek;
        });

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Get unique weeks from tournaments
  const weeks = [
    ...new Set(tournaments.map((t) => getWeekNumber(t.datum).toString())),
  ].sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Tenisový klub - Manažer
            </h1>
            <div className="flex items-center gap-3">
              {isAdmin && <RoleSwitcher />}
              <Link
                href="/password"
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Změnit heslo
              </Link>
              <button
                onClick={handleLogout}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Odhlásit se
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Filtrovat podle trenéra:
            </label>
            <select
              value={selectedCoachId}
              onChange={(e) => setSelectedCoachId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="all">Všichni trenéři</option>
              {coaches.map((coach) => (
                <option key={coach.id} value={coach.id}>
                  {coach.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Filtrovat podle týdne:
            </label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              <option value="all">Všechny týdny</option>
              {weeks.map((week) => (
                <option key={week} value={week}>
                  Týden {week}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Matrix View */}
        <div className="overflow-x-auto rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Turnaj
                </th>
                {filteredPlayers.map((player) => (
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
              {filteredTournaments.map((tournament) => {
                const tournamentEntries =
                  entriesByTournament[tournament.id] || [];
                return (
                  <tr key={tournament.id} className="hover:bg-gray-50">
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-4 py-3 text-sm">
                      <div className="font-medium">{tournament.nazev}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(tournament.datum)} • {tournament.misto}
                      </div>
                    </td>
                    {filteredPlayers.map((player) => {
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
              {filteredTournaments.length === 0 && (
                <tr>
                  <td
                    colSpan={filteredPlayers.length + 1}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    Žádné turnaje pro vybrané filtry.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="font-semibold">Celkem hráčů</h3>
            <p className="text-2xl font-bold text-blue-600">
              {filteredPlayers.length}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="font-semibold">Celkem turnajů</h3>
            <p className="text-2xl font-bold text-green-600">
              {filteredTournaments.length}
            </p>
          </div>
          <div className="rounded-lg bg-white p-4 shadow">
            <h3 className="font-semibold">Celkem přihlášek</h3>
            <p className="text-2xl font-bold text-purple-600">
              {entries.filter((e) =>
                filteredPlayers.some((p) => p.id === e.player_id)
              ).length}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate, getWeekNumber, getWeekRange } from '@/lib/utils';
import { isDemoMode } from '@/lib/demo-utils';
import type { Database } from '@/types/database';

type Player = Database['public']['Tables']['player']['Row'];
type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'] & {
  tournament: Tournament;
  player: Player;
};

interface ParentDashboardProps {
  players: Player[];
  entries: Entry[];
  tournaments: Tournament[];
  userEmail: string;
}

export default function ParentDashboard({
  players: initialPlayers,
  entries: initialEntries,
  tournaments: initialTournaments,
  userEmail,
}: ParentDashboardProps) {
  const [players, setPlayers] = useState(initialPlayers);
  const [entries, setEntries] = useState(initialEntries);
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(
    initialPlayers[0] || null
  );
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  // Group entries by week
  const entriesByWeek = entries.reduce((acc, entry) => {
    const weekNum = getWeekNumber(entry.tournament.datum);
    if (!acc[weekNum]) {
      acc[weekNum] = [];
    }
    acc[weekNum].push(entry);
    return acc;
  }, {} as Record<number, Entry[]>);

  const handleAddTournament = async (formData: FormData) => {
    if (isDemoMode()) {
      alert('V demo režimu nelze přidávat turnaje. Pro plnou funkcionalitu se přihlas pomocí Supabase.');
      return;
    }

    setLoading(true);
    try {
      const playerId = formData.get('player_id') as string;
      const nazev = formData.get('nazev') as string;
      const kategorie = formData.get('kategorie') as string;
      const misto = formData.get('misto') as string;
      const datum = formData.get('datum') as string;
      const poznamka = formData.get('poznamka') as string;
      const priority = parseInt(formData.get('priority') as string);

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      // Get app_user id
      const { data: appUser } = await supabase
        .from('app_user')
        .select('id')
        .eq('email', user.email!)
        .single();

      if (!appUser) return;

      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournament')
        .insert({
          nazev,
          kategorie,
          misto,
          datum,
          poznamka: poznamka || null,
          created_by: appUser.id,
        })
        .select()
        .single();

      if (tournamentError) {
        alert('Chyba při vytváření turnaje: ' + tournamentError.message);
        return;
      }

      // Create entry
      const { error: entryError } = await supabase.from('entry').insert({
        player_id: playerId,
        tournament_id: tournament.id,
        priority,
        status: 'planovano',
        poznamka_rodic: poznamka || null,
      });

      if (entryError) {
        alert('Chyba při vytváření přihlášky: ' + entryError.message);
        return;
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
      setShowForm(false);
    }
  };

  const handleUpdateEntry = async (formData: FormData) => {
    if (isDemoMode()) {
      alert('V demo režimu nelze upravovat turnaje. Pro plnou funkcionalitu se přihlas pomocí Supabase.');
      return;
    }

    setLoading(true);
    try {
      const entryId = formData.get('entry_id') as string;
      const nazev = formData.get('nazev') as string;
      const kategorie = formData.get('kategorie') as string;
      const misto = formData.get('misto') as string;
      const datum = formData.get('datum') as string;
      const poznamka = formData.get('poznamka') as string;
      const priority = parseInt(formData.get('priority') as string);

      if (!editingEntry) return;

      // Update tournament
      const { error: tournamentError } = await supabase
        .from('tournament')
        .update({
          nazev,
          kategorie,
          misto,
          datum,
          poznamka: poznamka || null,
        })
        .eq('id', editingEntry.tournament_id);

      if (tournamentError) {
        alert('Chyba při aktualizaci turnaje: ' + tournamentError.message);
        return;
      }

      // Update entry
      const { error: entryError } = await supabase
        .from('entry')
        .update({
          priority,
          poznamka_rodic: poznamka || null,
        })
        .eq('id', entryId);

      if (entryError) {
        alert('Chyba při aktualizaci přihlášky: ' + entryError.message);
        return;
      }

      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
      setEditingEntry(null);
    }
  };

  const handleDeleteEntry = async (entryId: string, tournamentId: string) => {
    if (isDemoMode()) {
      alert('V demo režimu nelze mazat přihlášky. Pro plnou funkcionalitu se přihlas pomocí Supabase.');
      return;
    }

    if (!confirm('Opravdu chceš smazat tuto přihlášku?')) return;

    setLoading(true);
    try {
      // Delete entry
      const { error: entryError } = await supabase
        .from('entry')
        .delete()
        .eq('id', entryId);

      if (entryError) {
        alert('Chyba při mazání: ' + entryError.message);
        return;
      }

      // Check if tournament has other entries
      const { data: otherEntries } = await supabase
        .from('entry')
        .select('id')
        .eq('tournament_id', tournamentId)
        .limit(1);

      // If no other entries, delete tournament
      if (!otherEntries || otherEntries.length === 0) {
        await supabase.from('tournament').delete().eq('id', tournamentId);
      }

      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

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

  // Calculate played tournaments for selected player
  const playerEntries = entries.filter(
    (e) => e.player_id === selectedPlayer?.id
  );
  const playedCount = playerEntries.filter(
    (e) => e.status === 'odehrano'
  ).length;
  const limit = selectedPlayer?.limit_turnaju || 16;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">
              Tenisový klub - Rodič
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
        {/* Player Overview */}
        {selectedPlayer && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">
              {selectedPlayer.name}
            </h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <p className="text-sm text-gray-600">Datum narození</p>
                <p className="font-medium">
                  {formatDate(selectedPlayer.birth_date)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Ročník</p>
                <p className="font-medium">{selectedPlayer.rocnik}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Kategorie</p>
                <p className="font-medium">{selectedPlayer.category || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Odehrané turnaje</p>
                <p className="font-medium">
                  {playedCount} / {limit}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Player Selector */}
        {players.length > 1 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700">
              Vyber dítě:
            </label>
            <select
              value={selectedPlayer?.id || ''}
              onChange={(e) => {
                const player = players.find((p) => p.id === e.target.value);
                setSelectedPlayer(player || null);
              }}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Add Tournament Button */}
        {selectedPlayer && (
          <div className="mb-6">
            <button
              onClick={() => {
                setEditingEntry(null);
                setShowForm(true);
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Přidat turnaj
            </button>
          </div>
        )}

        {/* Tournament Form */}
        {(showForm || editingEntry) && selectedPlayer && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">
              {editingEntry ? 'Upravit turnaj' : 'Nový turnaj'}
            </h3>
            <form
              action={editingEntry ? handleUpdateEntry : handleAddTournament}
              className="space-y-4"
            >
              {editingEntry && (
                <input type="hidden" name="entry_id" value={editingEntry.id} />
              )}
              <input
                type="hidden"
                name="player_id"
                value={selectedPlayer.id}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Název turnaje *
                </label>
                <input
                  type="text"
                  name="nazev"
                  required
                  defaultValue={editingEntry?.tournament.nazev || ''}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Kategorie *
                </label>
                <input
                  type="text"
                  name="kategorie"
                  required
                  defaultValue={editingEntry?.tournament.kategorie || ''}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Místo *
                </label>
                <input
                  type="text"
                  name="misto"
                  required
                  defaultValue={editingEntry?.tournament.misto || ''}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Datum *
                </label>
                <input
                  type="date"
                  name="datum"
                  required
                  defaultValue={
                    editingEntry?.tournament.datum
                      ? editingEntry.tournament.datum
                      : ''
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Priorita (1-3) *
                </label>
                <select
                  name="priority"
                  required
                  defaultValue={editingEntry?.priority || 1}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value={1}>1 - Preferovaný</option>
                  <option value={2}>2 - Střední</option>
                  <option value={3}>3 - Nízká</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Poznámka
                </label>
                <textarea
                  name="poznamka"
                  rows={3}
                  defaultValue={editingEntry?.poznamka_rodic || ''}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Ukládám...' : editingEntry ? 'Uložit' : 'Přidat'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingEntry(null);
                  }}
                  className="rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
                >
                  Zrušit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tournaments by Week */}
        {selectedPlayer && (
          <div className="space-y-6">
            {Object.entries(entriesByWeek)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([weekNum, weekEntries]) => {
                const firstEntry = weekEntries[0];
                const weekRange = getWeekRange(firstEntry.tournament.datum);
                const filteredEntries = weekEntries.filter(
                  (e) => e.player_id === selectedPlayer.id
                );

                if (filteredEntries.length === 0) return null;

                return (
                  <div key={weekNum} className="rounded-lg bg-white p-6 shadow">
                    <h3 className="mb-4 text-lg font-semibold">
                      Týden {weekNum} ({formatDate(weekRange.start)} -{' '}
                      {formatDate(weekRange.end)})
                    </h3>
                    <div className="space-y-4">
                      {filteredEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-md border border-gray-200 p-4"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold">
                                {entry.tournament.nazev}
                              </h4>
                              <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600 md:grid-cols-4">
                                <div>
                                  <span className="font-medium">Kategorie:</span>{' '}
                                  {entry.tournament.kategorie}
                                </div>
                                <div>
                                  <span className="font-medium">Místo:</span>{' '}
                                  {entry.tournament.misto}
                                </div>
                                <div>
                                  <span className="font-medium">Datum:</span>{' '}
                                  {formatDate(entry.tournament.datum)}
                                </div>
                                <div>
                                  <span className="font-medium">Priorita:</span>{' '}
                                  P{entry.priority}
                                </div>
                                {entry.tournament.entry_deadline && (
                                  <div>
                                    <span className="font-medium">
                                      Uzávěrka:
                                    </span>{' '}
                                    {formatDate(entry.tournament.entry_deadline)}
                                  </div>
                                )}
                                {entry.tournament.withdraw_deadline && (
                                  <div>
                                    <span className="font-medium">
                                      Odhlášení do:
                                    </span>{' '}
                                    {formatDate(
                                      entry.tournament.withdraw_deadline
                                    )}
                                  </div>
                                )}
                              </div>
                              {entry.poznamka_rodic && (
                                <div className="mt-2 text-sm text-gray-600">
                                  <span className="font-medium">Poznámka:</span>{' '}
                                  {entry.poznamka_rodic}
                                </div>
                              )}
                            </div>
                            <div className="ml-4 flex gap-2">
                              <button
                                onClick={() => {
                                  setEditingEntry(entry);
                                  setShowForm(false);
                                }}
                                className="rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
                              >
                                Upravit
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteEntry(
                                    entry.id,
                                    entry.tournament_id
                                  )
                                }
                                className="rounded-md bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                              >
                                Smazat
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            {Object.keys(entriesByWeek).length === 0 && (
              <div className="rounded-lg bg-white p-6 text-center text-gray-500 shadow">
                Zatím nemáš žádné přihlášené turnaje.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  formatDate,
  formatTournamentName,
  getWeekNumber,
  getWeekRange,
  getAgeFromBirthDate,
  getMaxTournamentsForAge,
} from '@/lib/utils';
import type { Database } from '@/types/database';
import {
  registerPlayerForTournament,
  searchTournamentsByName,
  type RegisterTournamentParams,
  type ITFTournamentSearchResult,
} from '@/lib/tournament-service';
import TournamentNameInput from '@/components/TournamentNameInput';

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
  userEmail: string;
  userName: string;
}

export default function CoachDashboard({
  players: initialPlayers,
  entries: initialEntries,
  tournaments: initialTournaments,
  userEmail,
  userName,
}: CoachDashboardProps) {
  const [players, setPlayers] = useState(initialPlayers);
  const [entries, setEntries] = useState(initialEntries);
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(
    initialPlayers[0] || null
  );
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [showAddTournamentForm, setShowAddTournamentForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [useAutoSearch, setUseAutoSearch] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ITFTournamentSearchResult[] | null>(null);
  const [addPlayerBirthDate, setAddPlayerBirthDate] = useState('');
  const [editingEntryForTournament, setEditingEntryForTournament] = useState<Entry | null>(null);
  const [generatedCodeForPlayer, setGeneratedCodeForPlayer] = useState<{ playerId: string; code: string } | null>(null);
  const [generateCodeLoading, setGenerateCodeLoading] = useState(false);
  const [tournamentNameValue, setTournamentNameValue] = useState('');
  const [selectedTournament, setSelectedTournament] = useState<ITFTournamentSearchResult | null>(null);
  const supabase = createClient();

  // Update state when props change
  useEffect(() => {
    setPlayers(initialPlayers);
    setEntries(initialEntries);
    setTournaments(initialTournaments);
    setSelectedPlayer(initialPlayers[0] || null);
  }, [initialPlayers, initialEntries, initialTournaments]);

  // Reset add-player form preview when form is closed
  useEffect(() => {
    if (!showAddPlayerForm) setAddPlayerBirthDate('');
  }, [showAddPlayerForm]);

  // Reset tournament input when add-tournament form closes
  useEffect(() => {
    if (!showAddTournamentForm) {
      setTournamentNameValue('');
      setSelectedTournament(null);
    }
  }, [showAddTournamentForm]);

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

  // Group entries by week for selected player
  const playerEntries = entries.filter(
    (e) => e.player_id === selectedPlayer?.id
  );
  const entriesByWeek = playerEntries.reduce((acc, entry) => {
    const weekNum = getWeekNumber(entry.tournament.datum);
    if (!acc[weekNum]) {
      acc[weekNum] = [];
    }
    acc[weekNum].push(entry);
    return acc;
  }, {} as Record<number, Entry[]>);

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

  const handleAddPlayer = async (formData: FormData) => {
    setLoading(true);
    try {
      const name = formData.get('name') as string;
      const birthDate = formData.get('birth_date') as string;
      const rocnik = parseInt(formData.get('rocnik') as string);
      const category = formData.get('category') as string;

      // Validate required fields
      if (!name || !birthDate || !rocnik) {
        alert('Vyplň všechna povinná pole');
        setLoading(false);
        return;
      }

      // Validate birth date is not in future
      const birthDateObj = new Date(birthDate);
      if (birthDateObj > new Date()) {
        alert('Datum narození nemůže být v budoucnosti');
        setLoading(false);
        return;
      }

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

      const limitTurnaju = getMaxTournamentsForAge(
        getAgeFromBirthDate(birthDate)
      );

      // Create player (coach_id = self, parent_id = null)
      const { error: playerError } = await supabase.from('player').insert({
        name: name.trim(),
        birth_date: birthDate,
        rocnik,
        category: category.trim() || null,
        coach_id: appUser.id,
        parent_id: null,
        limit_turnaju: limitTurnaju,
      });

      if (playerError) {
        alert('Chyba při přidávání hráče: ' + playerError.message);
        return;
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
      setShowAddPlayerForm(false);
    }
  };

  const handleAddTournament = async (formData: FormData) => {
    setLoading(true);
    setSearchError(null);

    try {
      const playerId = formData.get('player_id') as string;
      const nazev = formData.get('nazev') as string;
      const priority = parseInt(formData.get('priority') as string);
      const poznamka = formData.get('poznamka') as string;

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert('Musíš být přihlášen');
        return;
      }

      // Get app_user id
      const { data: appUser } = await supabase
        .from('app_user')
        .select('id')
        .eq('email', user.email!)
        .single();

      if (!appUser) {
        alert('Uživatel nenalezen');
        return;
      }

      // If using auto search, try tournament service first
      if (useAutoSearch && nazev.trim()) {
        const baseParams: RegisterTournamentParams = {
          tournamentName: nazev.trim(),
          playerId,
          priority,
          poznamka: poznamka || undefined,
          userId: appUser.id,
        };

        // User selected from autocomplete dropdown
        if (selectedTournament) {
          const result = await registerPlayerForTournament(
            { ...baseParams, selectedTournament },
            supabase
          );
          setSelectedTournament(null);
          setTournamentNameValue('');
          if (result.success) {
            alert(result.message);
            window.location.reload();
            return;
          }
          alert(result.message);
          setLoading(false);
          return;
        }

        // User selected one of multiple results
        if (searchResults && searchResults.length > 1) {
          const selectedKey = formData.get('selectedTournamentKey') as string | null;
          if (!selectedKey) {
            alert('Vyberte turnaj z nabídky.');
            setLoading(false);
            return;
          }
          const selected = searchResults.find((r) => r.tournamentKey === selectedKey);
          if (!selected) {
            setLoading(false);
            return;
          }
          const result = await registerPlayerForTournament(
            { ...baseParams, selectedTournament: selected },
            supabase
          );
          setSearchResults(null);
          if (result.success) {
            alert(result.message);
            window.location.reload();
            return;
          }
          alert(result.message);
          setLoading(false);
          return;
        }

        // Search for tournaments (up to 10 results)
        const results = await searchTournamentsByName(supabase, nazev.trim(), 10);

        if (results.length === 0) {
          setSearchError('Turnaj nebyl nalezen v seznamu turnajů. Použijte prosím ruční zadání.');
          setUseAutoSearch(false);
          setLoading(false);
          return;
        }

        if (results.length === 1) {
          const result = await registerPlayerForTournament(
            { ...baseParams, selectedTournament: results[0] },
            supabase
          );
          if (result.success) {
            alert(result.message);
            window.location.reload();
            return;
          }
          alert(result.message);
          setLoading(false);
          return;
        }

        // Multiple results - show selection
        setSearchResults(results);
        setLoading(false);
        return;
      }

      // Manual entry (fallback or user choice)
      const kategorie = formData.get('kategorie') as string;
      const misto = formData.get('misto') as string;
      const datum = formData.get('datum') as string;

      if (!kategorie || !misto || !datum) {
        alert('Vyplň všechna povinná pole');
        return;
      }

      // Create tournament manually
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
      setShowAddTournamentForm(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Opravdu chceš smazat tuto přihlášku?')) return;

    setLoading(true);
    try {
      const { error } = await supabase.from('entry').delete().eq('id', entryId);

      if (error) {
        alert('Chyba při mazání přihlášky: ' + error.message);
        return;
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  const handleUnregisterEntry = async (entryId: string) => {
    if (!confirm('Opravdu chceš odhlásit tuto přihlášku?')) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('entry')
        .update({ status: 'odhlasen' })
        .eq('id', entryId);

      if (error) {
        alert('Chyba při odhlašování: ' + error.message);
        return;
      }

      setEntries(
        entries.map((e) =>
          e.id === entryId ? { ...e, status: 'odhlasen' as const } : e
        )
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreEntry = async (entryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('entry')
        .update({ status: 'planovano' })
        .eq('id', entryId);

      if (error) {
        alert('Chyba při obnovení: ' + error.message);
        return;
      }

      setEntries(
        entries.map((e) =>
          e.id === entryId ? { ...e, status: 'planovano' as const } : e
        )
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPlayed = async (entryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('entry')
        .update({ status: 'odehrano' })
        .eq('id', entryId);

      if (error) {
        alert('Chyba při aktualizaci: ' + error.message);
        return;
      }

      setEntries(
        entries.map((e) =>
          e.id === entryId ? { ...e, status: 'odehrano' as const } : e
        )
      );
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTournament = async (formData: FormData) => {
    if (!editingEntryForTournament) return;

    const nazev = formData.get('nazev') as string;
    const kategorie = formData.get('kategorie') as string;
    const misto = formData.get('misto') as string;
    const datum = formData.get('datum') as string;

    if (!nazev?.trim() || !kategorie?.trim() || !misto?.trim() || !datum) {
      alert('Vyplň všechna pole');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('tournament')
        .update({
          nazev: nazev.trim(),
          kategorie: kategorie.trim(),
          misto: misto.trim(),
          datum,
        })
        .eq('id', editingEntryForTournament.tournament_id);

      if (error) {
        alert('Chyba při úpravě turnaje: ' + error.message);
        return;
      }

      setEditingEntryForTournament(null);
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  const playedCount = selectedPlayer
    ? getPlayedCount(selectedPlayer.id)
    : 0;
  const limit = selectedPlayer
    ? getMaxTournamentsForAge(getAgeFromBirthDate(selectedPlayer.birth_date))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Tenisový klub - Trenér
              </h1>
              {userName && (
                <p className="text-sm text-gray-600">{userName}</p>
              )}
              {!userName && userEmail && (
                <p className="text-sm text-gray-600">{userEmail}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
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
        {/* Empty State - No Players */}
        {(!players || players.length === 0) && !showAddPlayerForm && (
          <div className="mb-6 rounded-lg bg-white p-8 text-center shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Zatím nemáš přidané žádné hráče
            </h2>
            <p className="mb-6 text-gray-600">
              Přidej svého prvního hráče, abys mohl začít plánovat turnaje.
            </p>
            <button
              onClick={() => setShowAddPlayerForm(true)}
              className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
            >
              Přidat prvního hráče
            </button>
          </div>
        )}

        {/* Add Player Form */}
        {showAddPlayerForm && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Přidat hráče</h3>
            <form action={handleAddPlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Jméno *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Jméno hráče"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Datum narození *
                </label>
                <input
                  type="date"
                  name="birth_date"
                  required
                  value={addPlayerBirthDate}
                  onChange={(e) => setAddPlayerBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
                {addPlayerBirthDate && (
                  <p className="mt-1 text-sm text-gray-600">
                    Max. turnajů v sezóně:{' '}
                    {getMaxTournamentsForAge(
                      getAgeFromBirthDate(addPlayerBirthDate)
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Ročník *
                </label>
                <input
                  type="number"
                  name="rocnik"
                  required
                  min="1"
                  max="20"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Např. 2010"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Kategorie
                </label>
                <input
                  type="text"
                  name="category"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Např. U12"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Přidávám...' : 'Přidat hráče'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPlayerForm(false)}
                  className="rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
                >
                  Zrušit
                </button>
              </div>
            </form>
          </div>
        )}

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
              Vyber hráče:
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

        {/* Action Buttons */}
        {players.length > 0 && (
          <div className="mb-6 flex gap-4">
            <button
              onClick={() => setShowAddPlayerForm(true)}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              + Přidat hráče
            </button>
            {selectedPlayer && (
              <button
                onClick={() => setShowAddTournamentForm(true)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Přidat turnaj
              </button>
            )}
          </div>
        )}

        {/* Add Tournament Form */}
        {showAddTournamentForm && selectedPlayer && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">
              Přidat turnaj pro {selectedPlayer.name}
            </h3>
            <form action={handleAddTournament} className="space-y-4">
              <input type="hidden" name="player_id" value={selectedPlayer.id} />

              {/* Search mode toggle */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useAutoSearch}
                    onChange={(e) => {
                      setUseAutoSearch(e.target.checked);
                      setSearchError(null);
                      setSearchResults(null);
                    }}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">
                    Vyhledat v databázi turnajů
                  </span>
                </label>
              </div>

              {searchError && (
                <div className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                  {searchError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Název turnaje *
                </label>
                {useAutoSearch ? (
                  <TournamentNameInput
                    value={tournamentNameValue}
                    onChange={(v) => {
                      setTournamentNameValue(v);
                      setSearchResults(null);
                    }}
                    onSelect={(t) => setSelectedTournament(t)}
                    name="nazev"
                    required
                    placeholder="Zadejte část názvu turnaje..."
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                ) : (
                  <input
                    type="text"
                    name="nazev"
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    placeholder="Název turnaje"
                  />
                )}
              </div>

              {/* Multiple results selection */}
              {searchResults && searchResults.length > 1 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
                  <p className="mb-2 text-sm font-medium text-blue-800">
                    Nalezeno více turnajů. Vyberte správný:
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((r) => (
                      <label
                        key={r.tournamentKey}
                        className="flex cursor-pointer flex-col gap-0.5 rounded border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="radio"
                            name="selectedTournamentKey"
                            value={r.tournamentKey}
                            className="mt-1"
                          />
                          <span className="text-sm">
                            <span className="font-medium">{r.name}</span>
                            <br />
                            {r.city} • {formatDate(r.startDate)}
                            {r.category && ` • ${r.category}`}
                          </span>
                        </div>
                        {(r.entryDeadline || r.drawSize) && (
                          <div className="ml-6 text-xs text-gray-500">
                            {r.entryDeadline && <span>Přihlášky: {r.entryDeadline}</span>}
                            {r.entryDeadline && r.drawSize && ' · '}
                            {r.drawSize && <span>Draw: {r.drawSize}</span>}
                          </div>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual fields (shown when auto-search is off) */}
              {!useAutoSearch && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Kategorie *
                    </label>
                    <input
                      type="text"
                      name="kategorie"
                      required={!useAutoSearch}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      placeholder="Např. J60"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Místo *
                    </label>
                    <input
                      type="text"
                      name="misto"
                      required={!useAutoSearch}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                      placeholder="Město"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Datum *
                    </label>
                    <input
                      type="date"
                      name="datum"
                      required={!useAutoSearch}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Priorita *
                </label>
                <select
                  name="priority"
                  required
                  defaultValue="1"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="1">P1 - Nejvyšší</option>
                  <option value="2">P2 - Střední</option>
                  <option value="3">P3 - Nejnižší</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Poznámka
                </label>
                <textarea
                  name="poznamka"
                  rows={2}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Volitelná poznámka..."
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Přidávám...' : 'Přidat turnaj'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddTournamentForm(false);
                    setSearchResults(null);
                    setSearchError(null);
                  }}
                  className="rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
                >
                  Zrušit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Matrix View */}
        {players.length > 0 && tournaments.length > 0 && (
          <div className="mb-6 overflow-x-auto rounded-lg bg-white shadow">
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
                        {getMaxTournamentsForAge(
                          getAgeFromBirthDate(player.birth_date)
                        )}
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
                        <div className="font-medium">{formatTournamentName(tournament.nazev)}</div>
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
                              <div
                                className={`inline-block rounded-md px-2 py-1 ${
                                  entry.status === 'odhlasen'
                                    ? 'bg-gray-100'
                                    : 'bg-blue-50'
                                }`}
                              >
                                <div
                                  className={`text-xs font-medium ${
                                    entry.status === 'odhlasen'
                                      ? 'text-gray-600'
                                      : 'text-blue-900'
                                  }`}
                                >
                                  {entry.tournament.misto}
                                </div>
                                <div
                                  className={`text-xs ${
                                    entry.status === 'odhlasen'
                                      ? 'text-gray-500'
                                      : 'text-blue-700'
                                  }`}
                                >
                                  {entry.tournament.kategorie}
                                </div>
                                <div
                                  className={`text-xs font-semibold ${
                                    entry.status === 'odhlasen'
                                      ? 'text-gray-600'
                                      : 'text-blue-900'
                                  }`}
                                >
                                  P{entry.priority}
                                </div>
                                {entry.status === 'odehrano' && (
                                  <div className="mt-1 text-xs text-green-600">
                                    Odehráno
                                  </div>
                                )}
                                {entry.status === 'odhlasen' && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    Odhlášeno
                                  </div>
                                )}
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
              </tbody>
            </table>
          </div>
        )}

        {/* Player Tournaments List (by week) */}
        {selectedPlayer && Object.keys(entriesByWeek).length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">
              Turnaje - {selectedPlayer.name}
            </h3>
            {Object.entries(entriesByWeek)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([weekNum, weekEntries]) => {
                const firstEntry = weekEntries[0];
                const weekRange = getWeekRange(firstEntry.tournament.datum);
                return (
                  <div
                    key={weekNum}
                    className="rounded-lg bg-white p-4 shadow"
                  >
                    <h4 className="mb-3 font-medium text-gray-700">
                      Týden {weekNum} ({formatDate(weekRange.start)} -{' '}
                      {formatDate(weekRange.end)})
                    </h4>
                    <div className="space-y-2">
                      {weekEntries.map((entry) => (
                        <div key={entry.id}>
                          {editingEntryForTournament?.id === entry.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                handleUpdateTournament(new FormData(e.currentTarget as HTMLFormElement));
                              }}
                              className="rounded-md border-2 border-blue-200 bg-blue-50/50 p-4"
                            >
                              <h5 className="mb-3 text-sm font-medium text-gray-700">
                                Upravit turnaj
                              </h5>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <label className="block text-xs text-gray-600">Název</label>
                                  <input
                                    type="text"
                                    name="nazev"
                                    required
                                    defaultValue={formatTournamentName(entry.tournament.nazev)}
                                    className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600">Datum</label>
                                  <input
                                    type="date"
                                    name="datum"
                                    required
                                    defaultValue={entry.tournament.datum}
                                    className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600">Místo</label>
                                  <input
                                    type="text"
                                    name="misto"
                                    required
                                    defaultValue={entry.tournament.misto}
                                    className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs text-gray-600">Kategorie</label>
                                  <input
                                    type="text"
                                    name="kategorie"
                                    required
                                    defaultValue={entry.tournament.kategorie}
                                    className="mt-0.5 block w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                                  />
                                </div>
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="submit"
                                  disabled={loading}
                                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  {loading ? 'Ukládám...' : 'Uložit'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingEntryForTournament(null)}
                                  className="rounded bg-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-400"
                                >
                                  Zrušit
                                </button>
                              </div>
                            </form>
                          ) : (
                            <div className="flex items-center justify-between rounded-md bg-gray-50 p-3">
                              <div>
                                <p className="font-medium">
                                  {formatTournamentName(entry.tournament.nazev)}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {formatDate(entry.tournament.datum)} •{' '}
                                  {entry.tournament.misto} •{' '}
                                  {entry.tournament.kategorie}
                                </p>
                                <p className="text-sm">
                                  Priorita: P{entry.priority}
                                  {entry.status === 'odehrano' && (
                                    <span className="ml-2 text-green-600">
                                      (Odehráno)
                                    </span>
                                  )}
                                  {entry.status === 'odhlasen' && (
                                    <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs font-medium text-gray-600">
                                      Odhlášeno
                                    </span>
                                  )}
                                </p>
                                {(entry.tournament.sign_in_deadline_text ||
                                  entry.tournament.tournament_director_name ||
                                  entry.tournament.official_ball ||
                                  entry.tournament.draw_size) && (
                                  <div className="mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500">
                                    {entry.tournament.sign_in_deadline_text && (
                                      <p>
                                        <span className="font-medium">Přihlášky:</span>{' '}
                                        {entry.tournament.sign_in_deadline_text}
                                      </p>
                                    )}
                                    {entry.tournament.tournament_director_name && (
                                      <p>
                                        <span className="font-medium">Ředitel:</span>{' '}
                                        {entry.tournament.tournament_director_name}
                                      </p>
                                    )}
                                    {entry.tournament.official_ball && (
                                      <p>
                                        <span className="font-medium">Míček:</span>{' '}
                                        {entry.tournament.official_ball}
                                      </p>
                                    )}
                                    {entry.tournament.draw_size && (
                                      <p>
                                        <span className="font-medium">Draw:</span>{' '}
                                        {entry.tournament.draw_size}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => setEditingEntryForTournament(entry)}
                                  disabled={loading}
                                  className="rounded-md bg-amber-100 px-3 py-1 text-sm text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                                >
                                  Upravit
                                </button>
                                {entry.status !== 'odehrano' && (
                                  <button
                                    onClick={() => handleMarkAsPlayed(entry.id)}
                                    disabled={loading}
                                    className="rounded-md bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200 disabled:opacity-50"
                                  >
                                    Odehráno
                                  </button>
                                )}
                                {entry.status === 'odhlasen' ? (
                                  <button
                                    onClick={() => handleRestoreEntry(entry.id)}
                                    disabled={loading}
                                    className="rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                                  >
                                    Obnovit
                                  </button>
                                ) : (
                                  entry.status !== 'odehrano' && (
                                    <button
                                      onClick={() => handleUnregisterEntry(entry.id)}
                                      disabled={loading}
                                      className="rounded-md bg-orange-100 px-3 py-1 text-sm text-orange-700 hover:bg-orange-200 disabled:opacity-50"
                                    >
                                      Odhlásit
                                    </button>
                                  )
                                )}
                                <button
                                  onClick={() => handleDeleteEntry(entry.id)}
                                  disabled={loading}
                                  className="rounded-md bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 disabled:opacity-50"
                                >
                                  Smazat
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Summary Cards */}
        {players.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
            {players.map((player) => {
              const playerEntriesList = entriesByPlayer[player.id] || [];
              const playerPlayedCount = getPlayedCount(player.id);
              const showGeneratedCode = generatedCodeForPlayer?.playerId === player.id;
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
                    Turnaje: {playerPlayedCount} /{' '}
                    {getMaxTournamentsForAge(
                      getAgeFromBirthDate(player.birth_date)
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    Přihlášeno: {playerEntriesList.length}
                  </p>
                  {!player.parent_id && (
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={async () => {
                          setGenerateCodeLoading(true);
                          setGeneratedCodeForPlayer(null);
                          try {
                            const { data, error } = await supabase.rpc(
                              'generate_parent_connection_code',
                              { p_player_id: player.id, p_expires_in_days: 7 }
                            );
                            if (error) {
                              alert('Chyba: ' + error.message);
                              return;
                            }
                            const result = data as { success: boolean; code?: string; error?: string };
                            if (result.success && result.code) {
                              setGeneratedCodeForPlayer({ playerId: player.id, code: result.code });
                            } else {
                              alert(result.error ?? 'Nepodařilo se vygenerovat kód');
                            }
                          } finally {
                            setGenerateCodeLoading(false);
                          }
                        }}
                        disabled={generateCodeLoading}
                        className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                      >
                        {generateCodeLoading ? '…' : 'Vygenerovat kód pro rodiče'}
                      </button>
                      {showGeneratedCode && generatedCodeForPlayer && (
                        <div className="mt-2 rounded bg-amber-50 p-2 text-sm">
                          <p className="font-mono font-semibold text-amber-900">
                            {generatedCodeForPlayer.code}
                          </p>
                          <p className="mt-1 text-xs text-amber-700">
                            Předaj kód rodiči. Platnost 7 dní.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

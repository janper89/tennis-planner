'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { adjustManualPlayedAdjustment } from '@/lib/manual-played-adjustment';
import TournamentNameInput from '@/components/TournamentNameInput';
import TournamentFactsheetDetails from '@/components/TournamentFactsheetDetails';

type Player = Database['public']['Tables']['player']['Row'];
type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'] & {
  tournament: Tournament;
  player: Player;
};

interface PlayerDashboardProps {
  player: Player;
  entries: Entry[];
  tournaments: Tournament[];
  userEmail: string;
  userName: string;
}

export default function PlayerDashboard({
  player: initialPlayer,
  entries: initialEntries,
  tournaments: initialTournaments,
  userEmail,
  userName,
}: PlayerDashboardProps) {
  const [player, setPlayer] = useState(initialPlayer);
  const [entries, setEntries] = useState(initialEntries);
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [useAutoSearch, setUseAutoSearch] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ITFTournamentSearchResult[] | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(userName);
  const [tournamentNameValue, setTournamentNameValue] = useState('');
  const [selectedTournament, setSelectedTournament] = useState<ITFTournamentSearchResult | null>(null);
  const [showOnlyPendingConfirmation, setShowOnlyPendingConfirmation] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    setPlayer(initialPlayer);
    setEntries(initialEntries);
    setTournaments(initialTournaments);
    setNewName(userName);
  }, [initialPlayer, initialEntries, initialTournaments, userName]);

  useEffect(() => {
    if (!showForm) {
      setTournamentNameValue('');
      setSelectedTournament(null);
    } else if (editingEntry) {
      setTournamentNameValue(formatTournamentName(editingEntry.tournament.nazev));
      setSelectedTournament(null);
    }
  }, [showForm, editingEntry]);

  const entriesByWeek = entries.reduce((acc, entry) => {
    const weekNum = getWeekNumber(entry.tournament.datum);
    if (!acc[weekNum]) acc[weekNum] = [];
    acc[weekNum].push(entry);
    return acc;
  }, {} as Record<number, Entry[]>);

  const getEntryPlayedCount = (playerId: string) =>
    entries.filter((e) => e.player_id === playerId && e.status === 'odehrano').length;
  const getManualAdjustment = (playerId: string) =>
    Math.max(0, player.id === playerId ? player.manual_played_adjustment : 0);
  const getEffectivePlayedCount = (playerId: string) =>
    getEntryPlayedCount(playerId) + getManualAdjustment(playerId);

  const handleAdjustPlayedCount = async (playerId: string, delta: 1 | -1) => {
    const currentManual = getManualAdjustment(playerId);
    if (delta < 0 && currentManual <= 0) return;
    try {
      const nextValue = await adjustManualPlayedAdjustment(supabase, playerId, delta);
      setPlayer((p) => (p.id === playerId ? { ...p, manual_played_adjustment: nextValue } : p));
    } catch (e) {
      console.error(e);
      alert('Nepodařilo se upravit historicky odehrané turnaje.');
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

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert('Musíš být přihlášen');
        return;
      }
      const { data: appUser } = await supabase
        .from('app_user')
        .select('id')
        .eq('email', user.email!)
        .single();
      if (!appUser) {
        alert('Uživatel nenalezen');
        return;
      }

      if (useAutoSearch && nazev.trim()) {
        const baseParams: RegisterTournamentParams = {
          tournamentName: nazev.trim(),
          playerId,
          priority,
          poznamka: poznamka || undefined,
          userId: appUser.id,
        };
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
        const results = await searchTournamentsByName(supabase, nazev.trim(), 20);
        if (results.length === 0) {
          setSearchError('Turnaj nebyl nalezen. Použijte ruční zadání.');
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
        setSearchResults(results);
        setLoading(false);
        return;
      }

      const kategorie = formData.get('kategorie') as string;
      const misto = formData.get('misto') as string;
      const datum = formData.get('datum') as string;
      if (!kategorie || !misto || !datum) {
        alert('Vyplň všechna povinná pole');
        return;
      }
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
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
      setShowForm(false);
    }
  };

  const handleUpdateEntry = async (formData: FormData) => {
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
    } catch (e) {
      console.error(e);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
      setEditingEntry(null);
    }
  };

  const handleDeleteEntry = async (entryId: string, tournamentId: string) => {
    if (!confirm('Opravdu chceš smazat tuto přihlášku?')) return;
    setLoading(true);
    try {
      const { error: entryError } = await supabase
        .from('entry')
        .delete()
        .eq('id', entryId);
      if (entryError) {
        alert('Chyba při mazání: ' + entryError.message);
        return;
      }
      const { data: otherEntries } = await supabase
        .from('entry')
        .select('id')
        .eq('tournament_id', tournamentId)
        .limit(1);
      if (!otherEntries || otherEntries.length === 0) {
        await supabase.from('tournament').delete().eq('id', tournamentId);
      }
      window.location.reload();
    } catch (e) {
      console.error(e);
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
        alert('Chyba při označení turnaje: ' + error.message);
        setLoading(false);
        return;
      }
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, status: 'odehrano' as const } : e))
      );
    } catch (e) {
      console.error(e);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  const handleUnmarkAsPlayed = async (entryId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('entry')
        .update({ status: 'planovano' })
        .eq('id', entryId);
      if (error) {
        alert('Chyba při vrácení turnaje: ' + error.message);
        setLoading(false);
        return;
      }
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, status: 'planovano' as const } : e))
      );
    } catch (e) {
      console.error(e);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      alert('Jméno nemůže být prázdné');
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from('app_user')
        .update({ name: newName.trim() })
        .eq('email', user.email!);
      if (error) {
        alert('Chyba při aktualizaci jména: ' + error.message);
        return;
      }
      setEditingName(false);
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const isPastTournament = (datum: string) => {
    const tournamentDate = new Date(`${datum}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tournamentDate < today;
  };
  const needsPlayedConfirmation = (entry: Entry) =>
    entry.status !== 'odehrano' &&
    entry.status !== 'odhlasen' &&
    isPastTournament(entry.tournament.datum);

  const playedCount = getEffectivePlayedCount(player.id);
  const entryPlayedCount = getEntryPlayedCount(player.id);
  const manualAdjustment = getManualAdjustment(player.id);
  const pendingCount = entries.filter((e) => needsPlayedConfirmation(e)).length;
  const limit = getMaxTournamentsForAge(getAgeFromBirthDate(player.birth_date));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Tenisový klub – Hráč
              </h1>
              {editingName ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    placeholder="Zadej jméno"
                    autoFocus
                  />
                  <button
                    onClick={handleUpdateName}
                    disabled={loading}
                    className="rounded-md bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Uložit
                  </button>
                  <button
                    onClick={() => {
                      setEditingName(false);
                      setNewName(userName);
                    }}
                    className="rounded-md bg-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-400"
                  >
                    Zrušit
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2">
                  {userName?.trim() ? (
                    <>
                      <p className="text-sm font-medium text-gray-700">{userName}</p>
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-xs text-blue-600 hover:underline"
                        title="Upravit jméno"
                      >
                        ✏️
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">{userEmail}</p>
                      <button
                        onClick={() => setEditingName(true)}
                        className="rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                        title="Přidat jméno"
                      >
                        ✏️ Přidat jméno
                      </button>
                    </>
                  )}
                </div>
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
        {/* Player overview */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-semibold">{player.name}</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-sm text-gray-600">Datum narození</p>
              <p className="font-medium">{formatDate(player.birth_date)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Ročník</p>
              <p className="font-medium">{player.rocnik}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Kategorie</p>
              <p className="font-medium">{player.category || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Odehrané turnaje</p>
              <p className="font-medium">
                {playedCount} / {limit}
              </p>
              <div className="mt-1 flex items-center gap-2 text-xs text-gray-600">
                <button
                  type="button"
                  onClick={() => handleAdjustPlayedCount(player.id, -1)}
                  disabled={manualAdjustment <= 0}
                  className="rounded border border-gray-300 px-1.5 py-0.5 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Odečíst historicky přidaný odehraný turnaj"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPlayedCount(player.id, 1)}
                  className="rounded border border-gray-300 px-1.5 py-0.5 font-medium text-gray-700 hover:bg-gray-100"
                  title="Přidat historicky odehraný turnaj"
                >
                  +
                </button>
                <span>
                  Ze seznamu: {entryPlayedCount}, Historicky: {manualAdjustment}
                </span>
              </div>
              {pendingCount > 0 && (
                <p className="text-xs text-amber-700">Čeká na potvrzení: {pendingCount}</p>
              )}
            </div>
          </div>
        </div>

        {/* Add tournament */}
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

        {/* Tournament form */}
        {(showForm || editingEntry) && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">
              {editingEntry ? 'Upravit turnaj' : 'Nový turnaj'}
            </h3>
            {!editingEntry && (
              <div className="mb-4">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={useAutoSearch}
                      onChange={() => {
                        setUseAutoSearch(true);
                        setSearchError(null);
                        setSearchResults(null);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Automatické vyhledávání (ITF)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={!useAutoSearch}
                      onChange={() => {
                        setUseAutoSearch(false);
                        setSearchError(null);
                        setSearchResults(null);
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Ruční zadání</span>
                  </label>
                </div>
                {searchError && (
                  <div className="mt-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                    {searchError}
                    <p className="mt-1 text-xs">Můžeš pokračovat s ručním zadáním níže.</p>
                  </div>
                )}
              </div>
            )}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget as HTMLFormElement);
                if (editingEntry) {
                  await handleUpdateEntry(formData);
                } else {
                  await handleAddTournament(formData);
                }
              }}
              className="space-y-4"
            >
              {editingEntry && <input type="hidden" name="entry_id" value={editingEntry.id} />}
              {editingEntry?.status === 'odehrano' && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 text-sm font-medium text-amber-900">
                    Tento turnaj je označen jako odehrán.
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      await handleUnmarkAsPlayed(editingEntry.id);
                      setEditingEntry(null);
                      setShowForm(false);
                    }}
                    disabled={loading}
                    className="rounded-md bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                  >
                    Zrušit odehráno (vrátit na plánováno)
                  </button>
                </div>
              )}
              <input type="hidden" name="player_id" value={player.id} />
              <div>
                <label className="block text-sm font-medium text-gray-700">Název turnaje *</label>
                {useAutoSearch && !editingEntry ? (
                  <TournamentNameInput
                    value={tournamentNameValue}
                    onChange={(v) => {
                      setTournamentNameValue(v);
                      setSearchResults(null);
                    }}
                    onSelect={(t) => setSelectedTournament(t)}
                    name="nazev"
                    required
                    placeholder="Zadej název turnaje pro vyhledání v ITF"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                ) : (
                  <input
                    type="text"
                    name="nazev"
                    required
                    defaultValue={editingEntry ? formatTournamentName(editingEntry.tournament.nazev) : ''}
                    onChange={() => setSearchResults(null)}
                    placeholder="Název turnaje"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                )}
              </div>
              {searchResults && searchResults.length > 1 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                  <p className="mb-2 text-sm font-medium text-blue-900">
                    Vyberte turnaj ({searchResults.length} shod):
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((r) => (
                      <label
                        key={r.tournamentKey}
                        className="flex cursor-pointer flex-col gap-0.5 rounded border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="selectedTournamentKey"
                            value={r.tournamentKey}
                            required
                            className="h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-800">
                            {r.name} – {r.city} – {formatDate(r.startDate)}
                            {r.category ? ` (${r.category})` : ''}
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
              {(!useAutoSearch || editingEntry || searchError) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Kategorie *</label>
                    <input
                      type="text"
                      name="kategorie"
                      required={!useAutoSearch || !!searchError}
                      defaultValue={editingEntry?.tournament.kategorie || ''}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Místo *</label>
                    <input
                      type="text"
                      name="misto"
                      required={!useAutoSearch || !!searchError}
                      defaultValue={editingEntry?.tournament.misto || ''}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Datum *</label>
                    <input
                      type="date"
                      name="datum"
                      required={!useAutoSearch || !!searchError}
                      defaultValue={editingEntry?.tournament.datum ?? ''}
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Priorita (1-3) *</label>
                <select
                  name="priority"
                  required
                  defaultValue={editingEntry?.priority ?? 1}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value={1}>1 - Preferovaný</option>
                  <option value={2}>2 - Střední</option>
                  <option value={3}>3 - Nízká</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Poznámka</label>
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
                    setSearchError(null);
                    setSearchResults(null);
                    setUseAutoSearch(true);
                  }}
                  className="rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
                >
                  Zrušit
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tournaments by week */}
        <div className="space-y-6">
          <div className="flex justify-end">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showOnlyPendingConfirmation}
                onChange={(e) => setShowOnlyPendingConfirmation(e.target.checked)}
                className="rounded border-gray-300"
              />
              Jen čekající na potvrzení
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                {pendingCount}
              </span>
            </label>
          </div>
          {Object.entries(entriesByWeek)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([weekNum, weekEntries]) => {
              const firstEntry = weekEntries[0];
              const weekRange = getWeekRange(firstEntry.tournament.datum);
              const filteredEntries = weekEntries.filter((e) =>
                showOnlyPendingConfirmation ? needsPlayedConfirmation(e) : true
              );
              if (filteredEntries.length === 0) return null;
              return (
                <div key={weekNum} className="rounded-lg bg-white p-6 shadow">
                  <h3 className="mb-4 text-lg font-semibold">
                    Týden {weekNum} ({formatDate(weekRange.start)} - {formatDate(weekRange.end)})
                  </h3>
                  <div className="space-y-4">
                    {filteredEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className={`rounded-md border p-4 ${
                          entry.status === 'odehrano'
                            ? 'border-green-200 bg-green-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold">
                                {formatTournamentName(entry.tournament.nazev)}
                              </h4>
                              {entry.status === 'odehrano' && (
                                <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-medium text-white">
                                  Odehráno
                                </span>
                              )}
                              {needsPlayedConfirmation(entry) && (
                                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                  Čeká na potvrzení
                                </span>
                              )}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-600 md:grid-cols-4">
                              <div>
                                <span className="font-medium">Kategorie:</span> {entry.tournament.kategorie}
                              </div>
                              <div>
                                <span className="font-medium">Místo:</span> {entry.tournament.misto}
                              </div>
                              <div>
                                <span className="font-medium">Datum:</span> {formatDate(entry.tournament.datum)}
                              </div>
                              <div>
                                <span className="font-medium">Priorita:</span> P{entry.priority}
                              </div>
                              {entry.tournament.entry_deadline && (
                                <div>
                                  <span className="font-medium">Uzávěrka:</span>{' '}
                                  {formatDate(entry.tournament.entry_deadline)}
                                </div>
                              )}
                              {entry.tournament.withdraw_deadline && (
                                <div>
                                  <span className="font-medium">Odhlášení do:</span>{' '}
                                  {formatDate(entry.tournament.withdraw_deadline)}
                                </div>
                              )}
                            </div>
                            <TournamentFactsheetDetails tournament={entry.tournament} />
                            {entry.poznamka_rodic && (
                              <div className="mt-2 text-sm text-gray-600">
                                <span className="font-medium">Poznámka:</span> {entry.poznamka_rodic}
                              </div>
                            )}
                          </div>
                          <div className="ml-4 flex flex-wrap gap-2">
                            {entry.status !== 'odehrano' && entry.status !== 'odhlasen' && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsPlayed(entry.id)}
                                disabled={loading}
                                className="rounded-md bg-green-100 px-3 py-1 text-sm text-green-700 hover:bg-green-200 disabled:opacity-50"
                              >
                                {needsPlayedConfirmation(entry) ? 'Potvrdit odehráno' : 'Odehráno'}
                              </button>
                            )}
                            {entry.status === 'odehrano' && (
                              <button
                                type="button"
                                onClick={() => handleUnmarkAsPlayed(entry.id)}
                                disabled={loading}
                                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                                title="Vrátit mezi plánované"
                              >
                                Zrušit odehráno
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingEntry(entry);
                                setShowForm(false);
                              }}
                              className="rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200"
                            >
                              Upravit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(entry.id, entry.tournament_id)}
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
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  formatDate,
  formatTournamentName,
  formatCompactTournamentLabel,
  formatCategory,
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

const PARENT_SELECTED_CHILD_STORAGE_PREFIX = 'tennis_club_parent_selected_player';

function readPersistedSelectedChildId(scope: string | undefined): string | null {
  if (typeof window === 'undefined' || !scope) return null;
  try {
    return sessionStorage.getItem(`${PARENT_SELECTED_CHILD_STORAGE_PREFIX}:${scope}`);
  } catch {
    return null;
  }
}

function persistSelectedChildId(scope: string | undefined, playerId: string) {
  if (typeof window === 'undefined' || !scope) return;
  try {
    sessionStorage.setItem(`${PARENT_SELECTED_CHILD_STORAGE_PREFIX}:${scope}`, playerId);
  } catch {
    // ignore quota / private mode
  }
}

interface ParentDashboardProps {
  players: Player[];
  entries: Entry[];
  tournaments: Tournament[];
  coaches: Coach[];
  userEmail: string;
  userName: string;
  /** When true, hide edit/add actions (manager viewing as parent) */
  readOnly?: boolean;
  /** When set, mutations use this parent_id (admin editing on behalf of parent) */
  impersonatedParentId?: string;
  /** When true, hide logout/password (manager viewing – those would affect manager's session) */
  hideSessionActions?: boolean;
}

export default function ParentDashboard({
  players: initialPlayers,
  entries: initialEntries,
  tournaments: initialTournaments,
  coaches,
  userEmail,
  userName,
  readOnly = false,
  impersonatedParentId,
  hideSessionActions = false,
}: ParentDashboardProps) {
  const [players, setPlayers] = useState(initialPlayers);
  const [entries, setEntries] = useState(initialEntries);
  const [tournaments, setTournaments] = useState(initialTournaments);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(
    initialPlayers[0] || null
  );
  const [showForm, setShowForm] = useState(false);
  const [showAddChildForm, setShowAddChildForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [useAutoSearch, setUseAutoSearch] = useState(true); // Toggle between auto search and manual entry
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ITFTournamentSearchResult[] | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(userName);
  const [addChildBirthDate, setAddChildBirthDate] = useState('');
  const [connectionCode, setConnectionCode] = useState('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<string | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [tournamentNameValue, setTournamentNameValue] = useState('');
  const [selectedTournament, setSelectedTournament] = useState<ITFTournamentSearchResult | null>(null);
  const [showOnlyPendingConfirmation, setShowOnlyPendingConfirmation] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [editPlayerCategory, setEditPlayerCategory] = useState<string[]>([]);
  const [editPlayerLoading, setEditPlayerLoading] = useState(false);
  const supabase = createClient();
  const router = useRouter();

  // Update state when props change
  useEffect(() => {
    setPlayers(initialPlayers);
    setEntries(initialEntries);
    setTournaments(initialTournaments);
    setSelectedPlayer((prev) => {
      const scope = impersonatedParentId ?? userEmail;
      const savedId = readPersistedSelectedChildId(scope);
      if (savedId) {
        const fromStorage = initialPlayers.find((p) => p.id === savedId);
        if (fromStorage) return fromStorage;
      }
      if (prev && initialPlayers.some((p) => p.id === prev.id)) {
        return prev;
      }
      return initialPlayers[0] || null;
    });
    setNewName(userName);
  }, [initialPlayers, initialEntries, initialTournaments, userName, impersonatedParentId]);

  // Reset add-child form preview when form is closed
  useEffect(() => {
    if (!showAddChildForm) setAddChildBirthDate('');
  }, [showAddChildForm]);

  // Reset tournament input when form closes or editing changes
  useEffect(() => {
    if (!showForm) {
      setTournamentNameValue('');
      setSelectedTournament(null);
    } else if (editingEntry) {
      setTournamentNameValue(formatTournamentName(editingEntry.tournament.nazev));
      setSelectedTournament(null);
    }
  }, [showForm, editingEntry]);

  // Group entries by week (legacy odhlasen záznamy skrýváme – v minimal modu neslouží).
  const entriesByWeek = entries
    .filter((e) => e.status !== 'odhlasen')
    .reduce((acc, entry) => {
      const weekNum = getWeekNumber(entry.tournament.datum);
      if (!acc[weekNum]) {
        acc[weekNum] = [];
      }
      acc[weekNum].push(entry);
      return acc;
    }, {} as Record<number, Entry[]>);

  const getEntryPlayedCount = (playerId: string) =>
    entriesByWeek
      ? entries.filter((e) => e.player_id === playerId && e.status === 'odehrano').length
      : 0;

  const getManualAdjustment = (playerId: string) =>
    Math.max(0, players.find((p) => p.id === playerId)?.manual_played_adjustment ?? 0);

  const getEffectivePlayedCount = (playerId: string) =>
    getEntryPlayedCount(playerId) + getManualAdjustment(playerId);

  const handleAdjustPlayedCount = async (playerId: string, delta: 1 | -1) => {
    const currentManual = getManualAdjustment(playerId);
    if (delta < 0 && currentManual <= 0) return;

    try {
      const nextValue = await adjustManualPlayedAdjustment(supabase, playerId, delta);
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === playerId ? { ...p, manual_played_adjustment: nextValue } : p
        )
      );
    } catch (error) {
      console.error('Error adjusting manual played count:', error);
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

        // Uživatel vybral turnaj z autocomplete dropdownu
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

        // Uživatel vybral jeden z více výsledků – přihlásit na vybraný turnaj
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

        // Vyhledat turnaje (až 10 výsledků)
        const results = await searchTournamentsByName(supabase, nazev.trim(), 20);

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

        // Více výsledků – zobrazit výběr
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
    if (!confirm('Opravdu chceš smazat tuto přihlášku?')) return;

    setLoading(true);
    try {
      // Soft delete entry
      const { error: entryError } = await supabase
        .from('entry')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', entryId);

      if (entryError) {
        alert('Chyba při mazání: ' + entryError.message);
        return;
      }

      // Check if tournament has other non-deleted entries
      const { data: otherEntries } = await supabase
        .from('entry')
        .select('id')
        .eq('tournament_id', tournamentId)
        .is('deleted_at', null)
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
        prev.map((e) =>
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
        prev.map((e) =>
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

  const handleAddChild = async (formData: FormData) => {
    setLoading(true);
    try {
      const name = formData.get('name') as string;
      const birthDate = formData.get('birth_date') as string;
      const rocnikRaw = formData.get('rocnik') as string;
      const rocnik = parseInt(rocnikRaw, 10);
      const categoryValues = formData.getAll('category') as string[];
      const category = categoryValues.length > 0 ? categoryValues : null;
      const coachId = formData.get('coach_id') as string;

      // Validate required fields
      if (!name || !birthDate || !rocnikRaw || !coachId) {
        alert('Vyplň všechna povinná pole');
        setLoading(false);
        return;
      }
      if (Number.isNaN(rocnik) || rocnik < 2000 || rocnik > 2025) {
        alert('Ročník musí být rok narození (2000–2025)');
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

      const parentId = impersonatedParentId;
      if (!parentId) {
        // Normal parent flow – get current user's app_user id
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;
        const { data: appUser } = await supabase
          .from('app_user')
          .select('id')
          .eq('email', user.email!)
          .single();
        if (!appUser) return;
        // Check for duplicate (same name + birth_date)
        const { data: existing } = await supabase
          .from('player')
          .select('id, name')
          .eq('name', name.trim())
          .eq('birth_date', birthDate)
          .is('deleted_at', null);
        if (existing?.length) {
          alert(
            `Hráč se stejným jménem a datem narození už existuje (${existing[0].name}). Duplicitního hráče nelze přidat.`
          );
          setLoading(false);
          return;
        }
        // Use appUser.id for parent_id
        const { error: playerError } = await supabase.from('player').insert({
          name: name.trim(),
          birth_date: birthDate,
          rocnik,
          category: category,
          parent_id: appUser.id,
          coach_id: coachId,
          limit_turnaju: getMaxTournamentsForAge(getAgeFromBirthDate(birthDate)),
        });
        if (playerError) {
          alert('Chyba při přidávání dítěte: ' + playerError.message);
          return;
        }
        window.location.reload();
        return;
      }

      // Admin editing on behalf of parent – use impersonatedParentId
      const { data: existingAdmin } = await supabase
        .from('player')
        .select('id, name')
        .eq('name', name.trim())
        .eq('birth_date', birthDate)
        .is('deleted_at', null);
      if (existingAdmin?.length) {
        alert(
          `Hráč se stejným jménem a datem narození už existuje (${existingAdmin[0].name}). Duplicitního hráče nelze přidat.`
        );
        setLoading(false);
        return;
      }
      const limitTurnaju = getMaxTournamentsForAge(
        getAgeFromBirthDate(birthDate)
      );

      const { error: playerError } = await supabase.from('player').insert({
        name: name.trim(),
        birth_date: birthDate,
        rocnik,
        category: category,
        parent_id: parentId,
        coach_id: coachId,
        limit_turnaju: limitTurnaju,
      });

      if (playerError) {
        alert('Chyba při přidávání dítěte: ' + playerError.message);
        return;
      }

      // Refresh data
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
      setShowAddChildForm(false);
    }
  };

  const handleConnectWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectionError(null);
    setConnectionSuccess(null);
    const code = connectionCode.trim();
    if (!code) {
      setConnectionError('Zadej kód');
      return;
    }
    setConnectionLoading(true);
    try {
      const rpcName = impersonatedParentId
        ? 'manager_connect_child_with_code_for_parent'
        : 'connect_child_with_code';
      const rpcParams = impersonatedParentId
        ? { code_input: code, p_parent_id: impersonatedParentId }
        : { code_input: code };
      const { data, error } = await supabase.rpc(rpcName, rpcParams);
      if (error) {
        setConnectionError(error.message);
        return;
      }
      const result = data as { success: boolean; error?: string; player_name?: string };
      if (!result.success) {
        setConnectionError(result.error ?? 'Neplatný kód');
        return;
      }
      setConnectionSuccess(
        result.player_name ? `Připojeno dítě: ${result.player_name}` : 'Dítě bylo připojeno.'
      );
      setConnectionCode('');
      // Parent data are loaded client-side; force reload so newly linked child appears immediately.
      window.location.reload();
    } catch (err) {
      console.error(err);
      setConnectionError('Došlo k chybě');
    } finally {
      setConnectionLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  // Hybrid režim: po datu turnaje nabídnout potvrzení odehrání, ale status neměnit automaticky.
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

  const VALID_CATEGORIES = ['U16', 'U18'];

  const openEditPlayer = (player: Player) => {
    setEditingPlayer(player);
    const cats = player.category;
    const raw = Array.isArray(cats) ? cats : cats && typeof cats === 'string' ? [cats] : [];
    setEditPlayerCategory(raw.filter((c) => VALID_CATEGORIES.includes(c)));
  };

  const handleUpdatePlayerCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    if (editPlayerCategory.length === 0) {
      alert('Vyber alespoň jednu kategorii');
      return;
    }
    setEditPlayerLoading(true);
    try {
      const { error } = await supabase
        .from('player')
        .update({ category: editPlayerCategory })
        .eq('id', editingPlayer.id);

      if (error) {
        alert('Chyba při ukládání: ' + error.message);
        return;
      }
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === editingPlayer.id ? { ...p, category: editPlayerCategory } : p
        )
      );
      setSelectedPlayer((prev) =>
        prev?.id === editingPlayer.id ? { ...prev!, category: editPlayerCategory } : prev
      );
      setEditingPlayer(null);
    } catch (err) {
      console.error('Error updating player:', err);
      alert('Došlo k chybě');
    } finally {
      setEditPlayerLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      alert('Jméno nemůže být prázdné');
      return;
    }

    setLoading(true);
    try {
      if (impersonatedParentId) {
        // Admin updating parent's name on their behalf
        const { error } = await supabase
          .from('app_user')
          .update({ name: newName.trim() })
          .eq('id', impersonatedParentId);

        if (error) {
          alert('Chyba při aktualizaci jména: ' + error.message);
          return;
        }
      } else {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
          .from('app_user')
          .update({ name: newName.trim() })
          .eq('email', user.email!);

        if (error) {
          alert('Chyba při aktualizaci jména: ' + error.message);
          return;
        }
      }

      setEditingName(false);
      window.location.reload();
    } catch (error) {
      console.error('Error:', error);
      alert('Došlo k chybě');
    } finally {
      setLoading(false);
    }
  };

  // Calculate played tournaments for selected player
  const playerEntries = entries.filter(
    (e) => e.player_id === selectedPlayer?.id
  );
  const playedCount = selectedPlayer ? getEffectivePlayedCount(selectedPlayer.id) : 0;
  const selectedPlayerEntryPlayedCount = selectedPlayer
    ? getEntryPlayedCount(selectedPlayer.id)
    : 0;
  const selectedPlayerManualAdjustment = selectedPlayer
    ? getManualAdjustment(selectedPlayer.id)
    : 0;
  const pendingCount = playerEntries.filter((e) => needsPlayedConfirmation(e)).length;
  const limit = selectedPlayer
    ? getMaxTournamentsForAge(getAgeFromBirthDate(selectedPlayer.birth_date))
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                Tenisový klub - Rodič
              </h1>
              {readOnly ? (
                <p className="mt-1 text-sm text-gray-700">
                  {userName?.trim() || userEmail}
                </p>
              ) : editingName ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
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
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {userName && userName.trim() ? (
                    <>
                      <p className="text-sm font-medium text-gray-700">
                        {userName}
                      </p>
                      <button
                        onClick={() => setEditingName(true)}
                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                        title="Upravit jméno"
                      >
                        ✏️
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-gray-600">
                        {userEmail}
                      </p>
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
            {!readOnly && !hideSessionActions && (
              <div className="flex shrink-0 flex-wrap items-center gap-3">
                <Link
                  href="/trips"
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  title="Výjezdy"
                >
                  <span aria-hidden>🧳</span>
                  <span>Výjezdy</span>
                </Link>
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
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Connect child with code */}
        {!readOnly && (
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <h3 className="mb-2 text-lg font-semibold">Připojit dítě pomocí kódu</h3>
          <p className="mb-4 text-sm text-gray-600">
            Pokud ti trenér nebo manažer dal kód pro připojení k profilu dítěte, zadej ho níže.
          </p>
          <form onSubmit={handleConnectWithCode} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <label htmlFor="connection-code" className="sr-only">
                Kód
              </label>
              <input
                id="connection-code"
                type="text"
                value={connectionCode}
                onChange={(e) => setConnectionCode(e.target.value.toUpperCase())}
                placeholder="Např. A1B2C3D4"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                maxLength={20}
              />
            </div>
            <button
              type="submit"
              disabled={connectionLoading}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {connectionLoading ? 'Ověřuji...' : 'Připojit'}
            </button>
          </form>
          {connectionError && (
            <p className="mt-2 text-sm text-red-600">{connectionError}</p>
          )}
          {connectionSuccess && (
            <p className="mt-2 text-sm text-green-600">{connectionSuccess}</p>
          )}
        </div>
        )}

        {/* Empty State - No Children */}
        {(!players || players.length === 0) && (
          <div className="mb-6 rounded-lg bg-white p-8 text-center shadow">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Zatím nemáš přidané žádné dítě
            </h2>
            <p className="mb-6 text-gray-600">
              {readOnly
                ? 'Tento rodič zatím nemá přidané žádné dítě.'
                : 'Přidej své první dítě, abys mohl začít plánovat turnaje.'}
            </p>
            {!readOnly && (
              <button
                onClick={() => setShowAddChildForm(true)}
                className="rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Přidat první dítě
              </button>
            )}
          </div>
        )}

        {/* Add Child Form */}
        {showAddChildForm && !readOnly && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">Přidat dítě</h3>
            <form action={handleAddChild} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Jméno *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Jméno dítěte"
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
                  value={addChildBirthDate}
                  onChange={(e) => setAddChildBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
                {addChildBirthDate && (
                  <p className="mt-1 text-sm text-gray-600">
                    Max. turnajů v sezóně:{' '}
                    {getMaxTournamentsForAge(
                      getAgeFromBirthDate(addChildBirthDate)
                    )}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Ročník (rok narození, 4 číslice) *
                </label>
                <input
                  type="number"
                  name="rocnik"
                  required
                  min={2000}
                  max={2025}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Např. 2011"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Kategorie
                </label>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="category" value="U16" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">U16</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="category" value="U18" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">U18</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Trenér *
                </label>
                <select
                  name="coach_id"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">Vyber trenéra</option>
                  {coaches.map((coach) => (
                    <option key={coach.id} value={coach.id}>
                      {coach.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Přidávám...' : 'Přidat dítě'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddChildForm(false)}
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
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold">
                {selectedPlayer.name}
              </h2>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => openEditPlayer(selectedPlayer)}
                  className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Upravit
                </button>
              )}
            </div>
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
                <p className="font-medium">{formatCategory(selectedPlayer.category)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Odehrané turnaje</p>
                <p className="font-medium">
                  {playedCount} / {limit}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-600">
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => selectedPlayer && handleAdjustPlayedCount(selectedPlayer.id, -1)}
                        disabled={!selectedPlayer || selectedPlayerManualAdjustment <= 0}
                        className="rounded border border-gray-300 px-1.5 py-0.5 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Odečíst historicky přidaný odehraný turnaj"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => selectedPlayer && handleAdjustPlayedCount(selectedPlayer.id, 1)}
                        disabled={!selectedPlayer}
                        className="rounded border border-gray-300 px-1.5 py-0.5 font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Přidat historicky odehraný turnaj"
                      >
                        +
                      </button>
                    </>
                  )}
                  <span>Ze seznamu: {selectedPlayerEntryPlayedCount}</span>
                  <span>Historicky přidané: {selectedPlayerManualAdjustment}</span>
                </div>
                {pendingCount > 0 && (
                  <p className="text-xs text-amber-700">
                    Čeká na potvrzení: {pendingCount}
                  </p>
                )}
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
                if (player) {
                  persistSelectedChildId(impersonatedParentId ?? userEmail, player.id);
                }
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

        {/* Add Child Button */}
        {players.length > 0 && !readOnly && (
          <div className="mb-6">
            <button
              onClick={() => setShowAddChildForm(true)}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              + Přidat dítě
            </button>
          </div>
        )}

        {/* Add Tournament Button */}
        {selectedPlayer && !readOnly && (
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
        {(showForm || editingEntry) && selectedPlayer && !readOnly && (
          <div className="mb-6 rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 text-lg font-semibold">
              {editingEntry ? 'Upravit turnaj' : 'Nový turnaj'}
            </h3>
            
            {/* Toggle between auto search and manual entry (only for new entries) */}
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
                    <span className="text-sm font-medium text-gray-700">
                      Automatické vyhledávání (ITF)
                    </span>
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
                    <span className="text-sm font-medium text-gray-700">
                      Ruční zadání
                    </span>
                  </label>
                </div>
                {useAutoSearch && (
                  <p className="mt-2 text-xs text-gray-500">
                    Zadej název turnaje a systém ho automaticky vyhledá v ITF databázi
                  </p>
                )}
                {searchError && (
                  <div className="mt-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                    {searchError}
                    <p className="mt-1 text-xs">
                      Můžeš pokračovat s ručním zadáním níže.
                    </p>
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
              {editingEntry && (
                <input type="hidden" name="entry_id" value={editingEntry.id} />
              )}
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
              <input
                type="hidden"
                name="player_id"
                value={selectedPlayer.id}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Název turnaje *
                </label>
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
              {/* Výběr turnaje, když vyhledávání vrátí více výsledků */}
              {searchResults && searchResults.length > 1 && (
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
                  <p className="mb-2 text-sm font-medium text-blue-900">
                    Vyberte turnaj ({searchResults.length} shod):
                  </p>
                  <div className="space-y-2">
                    {searchResults.map((r) => (
                      <label
                        key={r.tournamentKey}
                        className="flex cursor-pointer items-start gap-2 rounded border border-gray-200 bg-white px-3 py-2 hover:bg-gray-50"
                      >
                        <input
                          type="radio"
                          name="selectedTournamentKey"
                          value={r.tournamentKey}
                          required
                          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-800">
                          <span className="font-medium">
                            {formatCompactTournamentLabel(r.category, r.city, r.name)}
                          </span>
                          <span className="text-gray-500"> · {formatDate(r.startDate)}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-blue-700">
                    Vyberte jeden turnaj a klikněte na „Přidat přihlášku“.
                  </p>
                </div>
              )}
              {/* Manual entry fields - shown when not using auto search or when editing */}
              {(!useAutoSearch || editingEntry || searchError) && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Kategorie *
                    </label>
                    <input
                      type="text"
                      name="kategorie"
                      required={!useAutoSearch || !!searchError}
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
                      required={!useAutoSearch || !!searchError}
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
                      required={!useAutoSearch || !!searchError}
                      defaultValue={
                        editingEntry?.tournament.datum
                          ? editingEntry.tournament.datum
                          : ''
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
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

        {/* Tournaments by Week */}
        {selectedPlayer && (
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
                const filteredEntries = weekEntries
                  .filter((e) => e.player_id === selectedPlayer.id)
                  .filter((e) =>
                    showOnlyPendingConfirmation ? needsPlayedConfirmation(e) : true
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
                          className={`rounded-md border p-4 ${
                            entry.status === 'odehrano'
                              ? 'border-green-200 bg-green-50'
                              : 'border-gray-200'
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold">
                                  {formatCompactTournamentLabel(
                                    entry.tournament.kategorie,
                                    entry.tournament.misto,
                                    entry.tournament.nazev
                                  )}
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
                              <p className="mt-1 text-sm text-gray-600">
                                {formatDate(entry.tournament.datum)} · Priorita P{entry.priority}
                              </p>
                              {entry.poznamka_rodic && (
                                <p className="mt-2 text-sm text-gray-600">
                                  <span className="font-medium">Poznámka:</span>{' '}
                                  {entry.poznamka_rodic}
                                </p>
                              )}
                            </div>
                            {!readOnly && (
                            <div className="flex flex-wrap gap-2 sm:ml-4 sm:shrink-0">
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
                                  title="Turnaj jsi neodehrál – vrátí se mezi plánované"
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
                            )}
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

        {/* Edit Player Category Modal */}
        {editingPlayer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Upravit kategorii – {editingPlayer.name}
              </h3>
              <form onSubmit={handleUpdatePlayerCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Kategorie *
                  </label>
                  <div className="mt-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editPlayerCategory.includes('U16')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditPlayerCategory((c) => [...c, 'U16']);
                          } else {
                            setEditPlayerCategory((c) => c.filter((x) => x !== 'U16'));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">U16</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editPlayerCategory.includes('U18')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditPlayerCategory((c) => [...c, 'U18']);
                          } else {
                            setEditPlayerCategory((c) => c.filter((x) => x !== 'U18'));
                          }
                        }}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">U18</span>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Vyber alespoň jednu kategorii</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingPlayer(null)}
                    className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    disabled={editPlayerLoading || editPlayerCategory.length === 0}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editPlayerLoading ? 'Ukládám...' : 'Uložit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  formatDate,
  formatTournamentName,
  getWeekNumber,
  getAgeFromBirthDate,
  getMaxTournamentsForAge,
} from '@/lib/utils';
import { ADMIN_EMAILS } from '@/lib/config';
import RoleSwitcher from '@/components/RoleSwitcher';
import TournamentNameInput from '@/components/TournamentNameInput';
import { registerPlayerForTournament, type ITFTournamentSearchResult } from '@/lib/tournament-service';
import { adjustManualPlayedAdjustment } from '@/lib/manual-played-adjustment';
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
type Parent = {
  id: string;
  email: string;
  created_at: string;
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
  const [parents, setParents] = useState<Parent[]>([]);
  const [showAddParentForm, setShowAddParentForm] = useState(false);
  const [newParentEmail, setNewParentEmail] = useState('');
  const [loadingParents, setLoadingParents] = useState(false);
  const [showAddTournamentForm, setShowAddTournamentForm] = useState(false);
  const [selectedPlayerForAdd, setSelectedPlayerForAdd] = useState<Player | null>(null);
  const [tournamentNameValue, setTournamentNameValue] = useState('');
  const [selectedTournament, setSelectedTournament] = useState<ITFTournamentSearchResult | null>(null);
  const [addTournamentPriority, setAddTournamentPriority] = useState(1);
  const [addTournamentPoznamka, setAddTournamentPoznamka] = useState('');
  const [addTournamentLoading, setAddTournamentLoading] = useState(false);
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [addPlayerBirthDate, setAddPlayerBirthDate] = useState('');
  const [addPlayerCoachId, setAddPlayerCoachId] = useState<string>('');
  const [addPlayerLoading, setAddPlayerLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Check if user is admin
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email && ADMIN_EMAILS.includes(user.email)) {
        setIsAdmin(true);
      }
    });
    // Load parents
    loadParents();
  }, []);

  const loadParents = async () => {
    try {
      const { data, error } = await supabase
        .from('app_user')
        .select('id, email, created_at')
        .eq('role', 'parent')
        .order('email');

      if (error) {
        console.error('Error loading parents:', error);
        return;
      }

      setParents(data || []);
    } catch (error) {
      console.error('Error loading parents:', error);
    }
  };

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingParents(true);

    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newParentEmail.trim())) {
        alert('Zadej platnou emailovou adresu');
        setLoadingParents(false);
        return;
      }

      // Check if parent already exists
      const { data: existing } = await supabase
        .from('app_user')
        .select('id')
        .eq('email', newParentEmail.trim())
        .single();

      if (existing) {
        alert('Rodič s tímto emailem již existuje');
        setLoadingParents(false);
        return;
      }

      // Create parent in app_user
      const { error: insertError } = await supabase
        .from('app_user')
        .insert({
          email: newParentEmail.trim(),
          role: 'parent',
        });

      if (insertError) {
        alert('Chyba při přidávání rodiče: ' + insertError.message);
        setLoadingParents(false);
        return;
      }

      // Success
      setNewParentEmail('');
      setShowAddParentForm(false);
      await loadParents();
      alert('Rodič byl úspěšně přidán. Rodič může použít "Zapomněl jsem heslo" na přihlašovací stránce.');
    } catch (error) {
      console.error('Error adding parent:', error);
      alert('Došlo k chybě při přidávání rodiče');
    } finally {
      setLoadingParents(false);
    }
  };

  const handleDeleteParent = async (parentId: string, parentEmail: string) => {
    if (!confirm(`Opravdu chceš smazat rodiče ${parentEmail}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('app_user')
        .delete()
        .eq('id', parentId);

      if (error) {
        alert('Chyba při mazání rodiče: ' + error.message);
        return;
      }

      await loadParents();
    } catch (error) {
      console.error('Error deleting parent:', error);
      alert('Došlo k chybě při mazání rodiče');
    }
  };

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

  const getEntryPlayedCount = (playerId: string) =>
    entriesByPlayer[playerId]?.filter((e) => e.status === 'odehrano').length || 0;

  const getManualAdjustment = (playerId: string) =>
    Math.max(0, players.find((p) => p.id === playerId)?.manual_played_adjustment ?? 0);

  // Calculate played tournaments for each player (entry played + manual adjustment)
  const getPlayedCount = (playerId: string) =>
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

  const handleMarkAsPlayed = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('entry')
        .update({ status: 'odehrano' })
        .eq('id', entryId);
      if (error) {
        alert('Chyba při označení odehráno: ' + error.message);
        return;
      }
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, status: 'odehrano' as const } : e))
      );
    } catch (error) {
      console.error('Error marking as played:', error);
      alert('Došlo k chybě');
    }
  };

  const handleUnmarkAsPlayed = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from('entry')
        .update({ status: 'planovano' })
        .eq('id', entryId);
      if (error) {
        alert('Chyba při vrácení odehráno: ' + error.message);
        return;
      }
      setEntries((prev) =>
        prev.map((e) => (e.id === entryId ? { ...e, status: 'planovano' as const } : e))
      );
    } catch (error) {
      console.error('Error unmarking played:', error);
      alert('Došlo k chybě');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleAddPlayer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAddPlayerLoading(true);
    const form = e.currentTarget;
    const name = (form.querySelector('[name="player_name"]') as HTMLInputElement)?.value?.trim();
    const birthDate = (form.querySelector('[name="player_birth_date"]') as HTMLInputElement)?.value;
    const rocnikStr = (form.querySelector('[name="player_rocnik"]') as HTMLInputElement)?.value;
    const category = (form.querySelector('[name="player_category"]') as HTMLInputElement)?.value?.trim() || null;

    if (!name || !birthDate || !rocnikStr) {
      alert('Vyplň jméno, datum narození a ročník');
      setAddPlayerLoading(false);
      return;
    }
    const rocnik = parseInt(rocnikStr, 10);
    if (Number.isNaN(rocnik) || rocnik < 1 || rocnik > 20) {
      alert('Ročník musí být číslo 1–20');
      setAddPlayerLoading(false);
      return;
    }
    const birthDateObj = new Date(birthDate);
    if (birthDateObj > new Date()) {
      alert('Datum narození nemůže být v budoucnosti');
      setAddPlayerLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert('Musíš být přihlášen');
        setAddPlayerLoading(false);
        return;
      }
      const { data: appUser } = await supabase
        .from('app_user')
        .select('id')
        .eq('email', user.email!)
        .single();
      if (!appUser) {
        alert('Uživatel nenalezen');
        setAddPlayerLoading(false);
        return;
      }

      const limitTurnaju = getMaxTournamentsForAge(getAgeFromBirthDate(birthDate));
      const coachId = addPlayerCoachId || appUser.id;

      const { error: playerError } = await supabase.from('player').insert({
        name,
        birth_date: birthDate,
        rocnik,
        category: category || null,
        coach_id: coachId,
        parent_id: null,
        limit_turnaju: limitTurnaju,
      });

      if (playerError) {
        alert('Chyba při přidávání hráče: ' + playerError.message);
        setAddPlayerLoading(false);
        return;
      }
      setShowAddPlayerForm(false);
      setAddPlayerBirthDate('');
      setAddPlayerCoachId('');
      window.location.reload();
    } catch (err) {
      console.error('Error adding player:', err);
      alert('Došlo k chybě při přidávání hráče');
    } finally {
      setAddPlayerLoading(false);
    }
  };

  const handleAddTournamentForManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerForAdd || !tournamentNameValue.trim()) {
      alert('Vyber hráče a zadej název turnaje');
      return;
    }
    setAddTournamentLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        alert('Musíš být přihlášen');
        setAddTournamentLoading(false);
        return;
      }
      const { data: appUser } = await supabase
        .from('app_user')
        .select('id')
        .eq('email', user.email!)
        .single();
      if (!appUser) {
        alert('Uživatel nenalezen');
        setAddTournamentLoading(false);
        return;
      }
      const result = await registerPlayerForTournament(
        {
          tournamentName: tournamentNameValue.trim(),
          playerId: selectedPlayerForAdd.id,
          priority: addTournamentPriority,
          poznamka: addTournamentPoznamka || undefined,
          userId: appUser.id,
          selectedTournament: selectedTournament ?? undefined,
        },
        supabase
      );
      if (result.success) {
        alert(result.message);
        setShowAddTournamentForm(false);
        setTournamentNameValue('');
        setSelectedTournament(null);
        setSelectedPlayerForAdd(null);
        window.location.reload();
      } else {
        alert(result.message);
      }
    } catch (err) {
      console.error('Error adding tournament:', err);
      alert('Došlo k chybě při přidávání turnaje');
    } finally {
      setAddTournamentLoading(false);
    }
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
        {/* Parents Management Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Správa rodičů
            </h2>
            <button
              onClick={() => {
                setShowAddParentForm(!showAddParentForm);
                setNewParentEmail('');
              }}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              {showAddParentForm ? 'Zrušit' : '+ Přidat rodiče'}
            </button>
          </div>

          {/* Add Parent Form */}
          {showAddParentForm && (
            <form onSubmit={handleAddParent} className="mb-4 space-y-4">
              <div>
                <label
                  htmlFor="parent-email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email rodiče
                </label>
                <input
                  id="parent-email"
                  type="email"
                  value={newParentEmail}
                  onChange={(e) => setNewParentEmail(e.target.value)}
                  required
                  placeholder="rodic@email.cz"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loadingParents}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingParents ? 'Přidávám...' : 'Přidat rodiče'}
              </button>
            </form>
          )}

          {/* Parents List */}
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Seznam rodičů ({parents.length})
            </h3>
            {parents.length === 0 ? (
              <p className="text-sm text-gray-500">
                Zatím nejsou přidáni žádní rodiče.
              </p>
            ) : (
              <div className="space-y-2">
                {parents.map((parent) => (
                  <div
                    key={parent.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 p-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{parent.email}</p>
                      <p className="text-xs text-gray-500">
                        Přidáno: {new Date(parent.created_at).toLocaleDateString('cs-CZ')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteParent(parent.id, parent.email)}
                      className="rounded-md bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                    >
                      Smazat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Add Player */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Přidat hráče</h2>
            <button
              onClick={() => {
                setShowAddPlayerForm(!showAddPlayerForm);
                if (!showAddPlayerForm) setAddPlayerBirthDate('');
              }}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              {showAddPlayerForm ? 'Zrušit' : '+ Přidat hráče'}
            </button>
          </div>
          {showAddPlayerForm && (
            <form onSubmit={handleAddPlayer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Jméno *</label>
                <input
                  type="text"
                  name="player_name"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Jméno hráče"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Datum narození *</label>
                <input
                  type="date"
                  name="player_birth_date"
                  required
                  value={addPlayerBirthDate}
                  onChange={(e) => setAddPlayerBirthDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
                {addPlayerBirthDate && (
                  <p className="mt-1 text-sm text-gray-600">
                    Max. turnajů v sezóně:{' '}
                    {getMaxTournamentsForAge(getAgeFromBirthDate(addPlayerBirthDate))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ročník *</label>
                <input
                  type="number"
                  name="player_rocnik"
                  required
                  min={1}
                  max={20}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Např. 2010"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kategorie</label>
                <input
                  type="text"
                  name="player_category"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Např. U12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Trenér (volitelné)</label>
                <select
                  value={addPlayerCoachId}
                  onChange={(e) => setAddPlayerCoachId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">— Přiřadit později / já (manažer)</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.email}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={addPlayerLoading}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {addPlayerLoading ? 'Přidávám...' : 'Přidat hráče'}
              </button>
            </form>
          )}
        </div>

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

        {/* Add Tournament */}
        <div className="mb-6">
          <button
            onClick={() => {
              setShowAddTournamentForm(!showAddTournamentForm);
              if (!showAddTournamentForm) {
                setSelectedPlayerForAdd(filteredPlayers[0] || null);
                setTournamentNameValue('');
                setSelectedTournament(null);
              }
            }}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            {showAddTournamentForm ? 'Zrušit' : '+ Přidat turnaj'}
          </button>

          {showAddTournamentForm && (
            <form
              onSubmit={handleAddTournamentForManager}
              className="mt-4 rounded-lg bg-white p-6 shadow"
            >
              <h3 className="mb-4 text-lg font-semibold">Přidat turnaj hráči</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Hráč *
                  </label>
                  <select
                    value={selectedPlayerForAdd?.id || ''}
                    onChange={(e) => {
                      const p = filteredPlayers.find((x) => x.id === e.target.value);
                      setSelectedPlayerForAdd(p || null);
                    }}
                    required
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">Vyber hráče</option>
                    {filteredPlayers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.rocnik} • {getAgeFromBirthDate(p.birth_date)} let)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Název turnaje *
                  </label>
                  <TournamentNameInput
                    value={tournamentNameValue}
                    onChange={setTournamentNameValue}
                    onSelect={setSelectedTournament}
                    name="nazev"
                    required
                    placeholder="Zadej název turnaje pro vyhledání"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Priorita (1–3)
                  </label>
                  <select
                    value={addTournamentPriority}
                    onChange={(e) => setAddTournamentPriority(parseInt(e.target.value, 10))}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Poznámka (volitelné)
                  </label>
                  <input
                    type="text"
                    value={addTournamentPoznamka}
                    onChange={(e) => setAddTournamentPoznamka(e.target.value)}
                    placeholder="Poznámka"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addTournamentLoading || !tournamentNameValue.trim() || !selectedPlayerForAdd}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {addTournamentLoading ? 'Přidávám...' : 'Přidat turnaj'}
                </button>
              </div>
            </form>
          )}
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
                      {getMaxTournamentsForAge(
                        getAgeFromBirthDate(player.birth_date)
                      )}
                    </div>
                    <div className="mt-1 flex items-center justify-center gap-1 text-[10px] font-normal normal-case text-gray-500">
                      <button
                        type="button"
                        onClick={() => handleAdjustPlayedCount(player.id, -1)}
                        disabled={getManualAdjustment(player.id) <= 0}
                        className="rounded border border-gray-300 px-1 py-0 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                        title="Odečíst historicky přidaný odehraný turnaj"
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustPlayedCount(player.id, 1)}
                        className="rounded border border-gray-300 px-1 py-0 hover:bg-gray-100"
                        title="Přidat historicky odehraný turnaj"
                      >
                        +
                      </button>
                      <span>H: {getManualAdjustment(player.id)}</span>
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
                    <td className="sticky left-0 z-10 bg-white px-4 py-3 text-sm">
                      <div className="font-medium">{formatTournamentName(tournament.nazev)}</div>
                      <div className="text-xs text-gray-500">
                        {formatDate(tournament.datum)} • {tournament.misto}
                      </div>
                      {(tournament.draw_size || tournament.official_ball) && (
                        <div className="mt-1 text-xs text-gray-400">
                          {tournament.draw_size && <span>Draw: {tournament.draw_size}</span>}
                          {tournament.draw_size && tournament.official_ball && ' · '}
                          {tournament.official_ball && <span>Míček: {tournament.official_ball}</span>}
                        </div>
                      )}
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
                              {entry.status === 'odehrano' && (
                                <div className="mt-1 text-xs text-green-700">Odehráno</div>
                              )}
                              {entry.status !== 'odhlasen' && (
                                <div className="mt-1 flex justify-center gap-1">
                                  {entry.status !== 'odehrano' && (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkAsPlayed(entry.id)}
                                      className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 hover:bg-green-200"
                                    >
                                      Odehráno
                                    </button>
                                  )}
                                  {entry.status === 'odehrano' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUnmarkAsPlayed(entry.id)}
                                      className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
                                    >
                                      Zrušit
                                    </button>
                                  )}
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

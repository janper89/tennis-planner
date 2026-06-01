'use client';

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  formatDate,
  formatCompactTournamentLabel,
  formatShortPlayerName,
  getWeekNumber,
  getWeekRange,
  getAgeFromBirthDate,
  getMaxTournamentsForAge,
  isActiveEntry,
} from '@/lib/utils';
import { ADMIN_EMAILS, ADMIN_EDIT_EMAILS } from '@/lib/config';
import RoleSwitcher from '@/components/RoleSwitcher';
import TournamentNameInput from '@/components/TournamentNameInput';
import ParentDashboard from '@/components/ParentDashboard';
import { registerPlayerForTournament, type ITFTournamentSearchResult } from '@/lib/tournament-service';
import { adjustManualPlayedAdjustment } from '@/lib/manual-played-adjustment';
import ErrorReportButton from '@/components/ErrorReportButton';
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
  name: string | null;
  created_at: string;
};
type PlayerAccount = {
  id: string;
  email: string;
  created_at: string;
};

interface ManagerDashboardProps {
  players: Player[];
  coaches: Coach[];
  entries: Entry[];
  tournaments: Tournament[];
  userEmail?: string;
}

export default function ManagerDashboard({
  players: initialPlayers,
  coaches,
  entries: initialEntries,
  tournaments: initialTournaments,
  userEmail: managerEmail = '',
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
  const [playerAccounts, setPlayerAccounts] = useState<PlayerAccount[]>([]);
  const [showAddPlayerAccountForm, setShowAddPlayerAccountForm] = useState(false);
  const [newPlayerAccountEmail, setNewPlayerAccountEmail] = useState('');
  const [loadingPlayerAccounts, setLoadingPlayerAccounts] = useState(false);
  const [generatedCodeForPlayer, setGeneratedCodeForPlayer] = useState<{
    playerId: string;
    code: string;
  } | null>(null);
  const [generateCodeLoadingPlayerId, setGenerateCodeLoadingPlayerId] = useState<string | null>(null);
  const [unlinkParentLoadingPlayerId, setUnlinkParentLoadingPlayerId] = useState<string | null>(null);
  const [deletePlayerLoadingId, setDeletePlayerLoadingId] = useState<string | null>(null);
  const [showDeletedPlayers, setShowDeletedPlayers] = useState(false);
  const [deletedPlayers, setDeletedPlayers] = useState<Player[]>([]);
  const [restorePlayerLoadingId, setRestorePlayerLoadingId] = useState<string | null>(null);
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
  const [viewingAsParentId, setViewingAsParentId] = useState<string | null>(null);
  const [viewingAsParentData, setViewingAsParentData] = useState<{
    players: Player[];
    entries: Entry[];
    tournaments: Tournament[];
    parentEmail: string;
    parentName: string;
  } | null>(null);
  const [loadingParentViewId, setLoadingParentViewId] = useState<string | null>(null);
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editingParentName, setEditingParentName] = useState('');
  const [editingParentLoading, setEditingParentLoading] = useState(false);
  const [parentsSectionOpen, setParentsSectionOpen] = useState(false);
  const [playerAccountsSectionOpen, setPlayerAccountsSectionOpen] = useState(false);
  const [linkingSectionOpen, setLinkingSectionOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // Check if user is admin
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email && ADMIN_EMAILS.includes(user.email)) {
        setIsAdmin(true);
      }
    });
    // Load parents and player accounts
    loadParents();
    loadPlayerAccounts();
    // Restore collapsed sections state
    if (typeof window !== 'undefined') {
      try {
        if (localStorage.getItem('manager.parentsOpen') === '1') setParentsSectionOpen(true);
        if (localStorage.getItem('manager.playerAccountsOpen') === '1') setPlayerAccountsSectionOpen(true);
        if (localStorage.getItem('manager.linkingOpen') === '1') setLinkingSectionOpen(true);
      } catch {
        // ignore (e.g. Safari private mode)
      }
    }
  }, []);

  const toggleSection = (
    key: 'manager.parentsOpen' | 'manager.playerAccountsOpen' | 'manager.linkingOpen',
    setter: Dispatch<SetStateAction<boolean>>
  ) => {
    setter((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(key, next ? '1' : '0');
        } catch {
          // ignore
        }
      }
      return next;
    });
  };

  const loadParents = async () => {
    try {
      const { data, error } = await supabase
        .from('app_user')
        .select('id, email, name, created_at')
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

  const loadPlayerAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('app_user')
        .select('id, email, created_at')
        .eq('role', 'player')
        .order('email');

      if (error) {
        console.error('Error loading player accounts:', error);
        return;
      }

      setPlayerAccounts(data || []);
    } catch (error) {
      console.error('Error loading player accounts:', error);
    }
  };

  const loadParentViewData = async (parentId: string, parentEmail: string, parentName: string | null) => {
    setLoadingParentViewId(parentId);
    try {
      const { data: playersData } = await supabase
        .from('player')
        .select('*')
        .eq('parent_id', parentId)
        .is('deleted_at', null)
        .order('name');

      const playerIds = playersData?.map((p) => p.id) || [];
      const { data: entriesData } = await supabase
        .from('entry')
        .select(
          `
          *,
          tournament:tournament_id (*),
          player:player_id (*)
        `
        )
        .in('player_id', playerIds.length > 0 ? playerIds : ['00000000-0000-0000-0000-000000000000'])
        .is('deleted_at', null)
        .order('tournament(datum)', { ascending: true });

      const tournamentIds = entriesData?.map((e) => e.tournament_id) || [];
      const { data: tournamentsData } = await supabase
        .from('tournament')
        .select('*')
        .in('id', tournamentIds.length > 0 ? tournamentIds : ['00000000-0000-0000-0000-000000000000'])
        .order('datum', { ascending: true });

      setViewingAsParentData({
        players: playersData || [],
        entries: (entriesData as Entry[]) || [],
        tournaments: tournamentsData || [],
        parentEmail,
        parentName: parentName?.trim() || parentEmail,
      });
      setViewingAsParentId(parentId);
    } catch (error) {
      console.error('Error loading parent view data:', error);
      alert('Nepodařilo se načíst data rodiče');
    } finally {
      setLoadingParentViewId(null);
    }
  };

  const openEditParentForm = (parent: Parent) => {
    setEditingParentId(parent.id);
    setEditingParentName(parent.name?.trim() || '');
  };

  const handleUpdateParentName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParentId) return;
    const name = editingParentName.trim();
    setEditingParentLoading(true);
    try {
      const { error } = await supabase
        .from('app_user')
        .update({ name: name || null })
        .eq('id', editingParentId);

      if (error) {
        alert('Chyba při ukládání: ' + error.message);
        return;
      }
      setEditingParentId(null);
      loadParents();
    } catch (err) {
      console.error('Error updating parent:', err);
      alert('Došlo k chybě');
    } finally {
      setEditingParentLoading(false);
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

  const handleAddPlayerAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingPlayerAccounts(true);

    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newPlayerAccountEmail.trim())) {
        alert('Zadej platnou emailovou adresu');
        setLoadingPlayerAccounts(false);
        return;
      }

      const { data: existing } = await supabase
        .from('app_user')
        .select('id')
        .eq('email', newPlayerAccountEmail.trim())
        .single();

      if (existing) {
        alert('Účet s tímto emailem již existuje');
        setLoadingPlayerAccounts(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('app_user')
        .insert({
          email: newPlayerAccountEmail.trim(),
          role: 'player',
        });

      if (insertError) {
        alert('Chyba při přidávání účtu hráče: ' + insertError.message);
        setLoadingPlayerAccounts(false);
        return;
      }

      setNewPlayerAccountEmail('');
      setShowAddPlayerAccountForm(false);
      await loadPlayerAccounts();
      alert('Účet hráče byl vytvořen. Hráč se přihlásí tímto emailem a může si jednou vytvořit vlastní profil.');
    } catch (error) {
      console.error('Error adding player account:', error);
      alert('Došlo k chybě při přidávání účtu hráče');
    } finally {
      setLoadingPlayerAccounts(false);
    }
  };

  const handleDeletePlayerAccount = async (accountId: string, accountEmail: string) => {
    if (!confirm(`Opravdu chceš smazat účet hráče ${accountEmail}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('app_user')
        .delete()
        .eq('id', accountId);

      if (error) {
        alert('Chyba při mazání účtu: ' + error.message);
        return;
      }

      await loadPlayerAccounts();
    } catch (error) {
      console.error('Error deleting player account:', error);
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

  const handleGenerateParentCode = async (playerId: string) => {
    setGenerateCodeLoadingPlayerId(playerId);
    setGeneratedCodeForPlayer(null);
    try {
      const { data, error } = await supabase.rpc('generate_parent_connection_code', {
        p_player_id: playerId,
        p_expires_in_days: 7,
      });
      if (error) {
        alert('Chyba: ' + error.message);
        return;
      }
      const result = data as { success: boolean; code?: string; error?: string };
      if (result.success && result.code) {
        setGeneratedCodeForPlayer({ playerId, code: result.code });
      } else {
        alert(result.error ?? 'Nepodařilo se vygenerovat kód');
      }
    } finally {
      setGenerateCodeLoadingPlayerId(null);
    }
  };

  const handleUnlinkParent = async (player: Player) => {
    if (
      !confirm(
        `Opravdu odpojit rodiče od hráče ${player.name}? Stávající propojení bude zrušeno.`
      )
    ) {
      return;
    }

    setUnlinkParentLoadingPlayerId(player.id);
    setGeneratedCodeForPlayer(null);
    try {
      const { data, error } = await supabase.rpc('manager_unlink_parent_from_player', {
        p_player_id: player.id,
      });

      if (error) {
        alert('Chyba při odpojování rodiče: ' + error.message);
        return;
      }

      const result = data as { success: boolean; error?: string };
      if (!result?.success) {
        alert(result?.error ?? 'Nepodařilo se odpojit rodiče');
        return;
      }

      setPlayers((prev) =>
        prev.map((p) =>
          p.id === player.id
            ? {
                ...p,
                parent_id: null,
                parent_connection_code: null,
                parent_connection_code_expires_at: null,
              }
            : p
        )
      );

      if (confirm('Rodič byl odpojen. Chceš hned vygenerovat nový kód pro přepojení?')) {
        await handleGenerateParentCode(player.id);
      }
    } finally {
      setUnlinkParentLoadingPlayerId(null);
    }
  };

  const handleRestorePlayer = async (player: Player) => {
    setRestorePlayerLoadingId(player.id);
    try {
      const { error: entryError } = await supabase
        .from('entry')
        .update({ deleted_at: null })
        .eq('player_id', player.id);
      if (entryError) {
        alert('Chyba při obnovování přihlášek: ' + entryError.message);
        return;
      }
      const { error } = await supabase
        .from('player')
        .update({ deleted_at: null })
        .eq('id', player.id);
      if (error) {
        alert('Chyba při obnovování hráče: ' + error.message);
        return;
      }
      setDeletedPlayers((prev) => prev.filter((p) => p.id !== player.id));
      setPlayers((prev) => [...prev, { ...player, deleted_at: null }]);
      window.location.reload();
    } finally {
      setRestorePlayerLoadingId(null);
    }
  };

  const handleDeletePlayer = async (player: Player) => {
    const entryCount = entriesByPlayer[player.id]?.length ?? 0;
    const msg =
      entryCount > 0
        ? `Opravdu smazat hráče ${player.name}? Smažou se i všechny jeho přihlášky na turnaje (${entryCount}).`
        : `Opravdu smazat hráče ${player.name}?`;
    if (!confirm(msg)) return;
    setDeletePlayerLoadingId(player.id);
    try {
      const now = new Date().toISOString();
      const { error: entryError } = await supabase
        .from('entry')
        .update({ deleted_at: now })
        .eq('player_id', player.id);
      if (entryError) {
        alert('Chyba při mazání přihlášek: ' + entryError.message);
        return;
      }
      const { error } = await supabase
        .from('player')
        .update({ deleted_at: now })
        .eq('id', player.id);
      if (error) {
        alert('Chyba při mazání hráče: ' + error.message);
        return;
      }
      setPlayers((prev) => prev.filter((p) => p.id !== player.id));
      setEntries((prev) => prev.filter((e) => e.player_id !== player.id));
    } finally {
      setDeletePlayerLoadingId(null);
    }
  };

  // Load deleted players when toggle is on
  useEffect(() => {
    if (!showDeletedPlayers) {
      setDeletedPlayers([]);
      return;
    }
    supabase
      .from('player')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('name')
      .then(({ data }) => setDeletedPlayers(data || []));
  }, [showDeletedPlayers]);

  // Filter players by coach
  const filteredPlayers =
    selectedCoachId === 'all'
      ? players
      : players.filter((p) => p.coach_id === selectedCoachId);

  // Filter deleted players by coach when showing them
  const filteredDeletedPlayers =
    showDeletedPlayers && selectedCoachId === 'all'
      ? deletedPlayers
      : showDeletedPlayers
        ? deletedPlayers.filter((p) => p.coach_id === selectedCoachId)
        : [];

  // Filter tournaments by week
  const filteredTournaments =
    selectedWeek === 'all'
      ? tournaments
      : tournaments.filter((t) => {
          const week = getWeekNumber(t.datum);
          return week.toString() === selectedWeek;
        });

  const tournamentsByWeek = filteredTournaments.reduce((acc, tournament) => {
    const weekNumber = getWeekNumber(tournament.datum);
    if (!acc[weekNumber]) {
      acc[weekNumber] = [];
    }
    acc[weekNumber].push(tournament);
    return acc;
  }, {} as Record<number, Tournament[]>);

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
    const categoryChecked = form.querySelectorAll<HTMLInputElement>('input[name="player_category"]:checked');
    const category = categoryChecked.length > 0 ? Array.from(categoryChecked).map((el) => el.value) : null;

    if (!name || !birthDate || !rocnikStr) {
      alert('Vyplň jméno, datum narození a ročník');
      setAddPlayerLoading(false);
      return;
    }
    const rocnik = parseInt(rocnikStr, 10);
    if (Number.isNaN(rocnik) || rocnik < 2000 || rocnik > 2025) {
      alert('Ročník musí být rok narození (2000–2025)');
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

      const { data: existing } = await supabase
        .from('player')
        .select('id, name')
        .eq('name', name)
        .eq('birth_date', birthDate)
        .is('deleted_at', null);
      if (existing?.length) {
        alert(
          `Hráč se stejným jménem a datem narození už existuje (${existing[0].name}). Duplicitního hráče nelze přidat.`
        );
        setAddPlayerLoading(false);
        return;
      }

      const limitTurnaju = getMaxTournamentsForAge(getAgeFromBirthDate(birthDate));
      const coachId = addPlayerCoachId || appUser.id;

      const { error: playerError } = await supabase.from('player').insert({
        name,
        birth_date: birthDate,
        rocnik,
        category: category,
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

  // View as parent mode – show parent's dashboard with banner
  if (viewingAsParentId && viewingAsParentData) {
    const canEdit = ADMIN_EDIT_EMAILS.includes(managerEmail);
    return (
      <div className="min-h-screen bg-gray-50">
        <div
          className={canEdit ? 'border-b border-blue-200 bg-blue-100 px-4 py-3' : 'border-b border-amber-200 bg-amber-100 px-4 py-3'}
        >
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <p className={`text-sm font-medium ${canEdit ? 'text-blue-900' : 'text-amber-900'}`}>
              {canEdit
                ? `Správa účtu: ${viewingAsParentData.parentName} — režim úprav`
                : `Zobrazení jako ${viewingAsParentData.parentName} — pouze prohlížení`}
            </p>
            <button
              onClick={() => {
                setViewingAsParentId(null);
                setViewingAsParentData(null);
              }}
              className={`shrink-0 rounded-md px-4 py-2 text-sm font-medium ${canEdit ? 'bg-blue-200 text-blue-900 hover:bg-blue-300' : 'bg-amber-200 text-amber-900 hover:bg-amber-300'}`}
            >
              Ukončit zobrazení
            </button>
          </div>
        </div>
        <ParentDashboard
          players={viewingAsParentData.players}
          entries={viewingAsParentData.entries}
          tournaments={viewingAsParentData.tournaments}
          coaches={coaches}
          userEmail={viewingAsParentData.parentEmail}
          userName={viewingAsParentData.parentName}
          readOnly={!canEdit}
          impersonatedParentId={canEdit ? viewingAsParentId : undefined}
          hideSessionActions
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
              Tenisový klub - Manažer
            </h1>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <ErrorReportButton profileLabel="Manažer" reporterEmail={managerEmail} />
              {isAdmin && <RoleSwitcher />}
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
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Parents Management Section */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => toggleSection('manager.parentsOpen', setParentsSectionOpen)}
              aria-expanded={parentsSectionOpen}
              className="flex flex-1 items-center gap-2 text-left"
            >
              <span
                className={`inline-block text-gray-500 transition-transform ${
                  parentsSectionOpen ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              >
                ▸
              </span>
              <h2 className="text-xl font-semibold text-gray-900">
                Správa rodičů{' '}
                <span className="text-sm font-normal text-gray-500">
                  ({parents.length})
                </span>
              </h2>
            </button>
            {parentsSectionOpen && (
              <button
                onClick={() => {
                  setShowAddParentForm(!showAddParentForm);
                  setNewParentEmail('');
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {showAddParentForm ? 'Zrušit' : '+ Přidat rodiče'}
              </button>
            )}
          </div>

          {parentsSectionOpen && (
          <>
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
                    className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-all font-medium text-gray-900">{parent.email}</p>
                      <p className="text-xs text-gray-500">
                        Přidáno: {new Date(parent.created_at).toLocaleDateString('cs-CZ')}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                      <button
                        onClick={() => loadParentViewData(parent.id, parent.email, parent.name)}
                        disabled={loadingParentViewId !== null}
                        className="rounded-md bg-blue-100 px-3 py-1 text-sm text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                      >
                        {loadingParentViewId === parent.id ? 'Načítám...' : 'Zobrazit jako'}
                      </button>
                      <button
                        onClick={() => openEditParentForm(parent)}
                        className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                      >
                        Upravit profil
                      </button>
                      <button
                        onClick={() => handleDeleteParent(parent.id, parent.email)}
                        className="rounded-md bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200"
                      >
                        Smazat
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Edit Parent Profile Modal */}
        {editingParentId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">
                Upravit profil rodiče
              </h3>
              <form onSubmit={handleUpdateParentName} className="space-y-4">
                <div>
                  <label
                    htmlFor="edit-parent-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Jméno
                  </label>
                  <input
                    id="edit-parent-name"
                    type="text"
                    value={editingParentName}
                    onChange={(e) => setEditingParentName(e.target.value)}
                    placeholder="Jméno rodiče"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingParentId(null)}
                    className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                  >
                    Zrušit
                  </button>
                  <button
                    type="submit"
                    disabled={editingParentLoading}
                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {editingParentLoading ? 'Ukládám...' : 'Uložit'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Player accounts (self-service role) */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => toggleSection('manager.playerAccountsOpen', setPlayerAccountsSectionOpen)}
              aria-expanded={playerAccountsSectionOpen}
              className="flex flex-1 items-center gap-2 text-left"
            >
              <span
                className={`inline-block text-gray-500 transition-transform ${
                  playerAccountsSectionOpen ? 'rotate-90' : ''
                }`}
                aria-hidden="true"
              >
                ▸
              </span>
              <h2 className="text-xl font-semibold text-gray-900">
                Účty hráčů (self-service){' '}
                <span className="text-sm font-normal text-gray-500">
                  ({playerAccounts.length})
                </span>
              </h2>
            </button>
            {playerAccountsSectionOpen && (
              <button
                onClick={() => {
                  setShowAddPlayerAccountForm(!showAddPlayerAccountForm);
                  setNewPlayerAccountEmail('');
                }}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {showAddPlayerAccountForm ? 'Zrušit' : '+ Přidat hráče (účet)'}
              </button>
            )}
          </div>
          {playerAccountsSectionOpen && (
          <>
          <p className="mb-4 text-sm text-gray-600">
            Účet s rolí hráč. Hráč se přihlásí emailem, jednou si vytvoří profil a pak si sám přidává turnaje.
          </p>
          {showAddPlayerAccountForm && (
            <form onSubmit={handleAddPlayerAccount} className="mb-4 space-y-4">
              <div>
                <label
                  htmlFor="player-account-email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email hráče
                </label>
                <input
                  id="player-account-email"
                  type="email"
                  value={newPlayerAccountEmail}
                  onChange={(e) => setNewPlayerAccountEmail(e.target.value)}
                  required
                  placeholder="hrac@email.cz"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loadingPlayerAccounts}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingPlayerAccounts ? 'Přidávám...' : 'Přidat účet hráče'}
              </button>
            </form>
          )}
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium text-gray-700">
              Seznam účtů hráčů ({playerAccounts.length})
            </h3>
            {playerAccounts.length === 0 ? (
              <p className="text-sm text-gray-500">
                Zatím nejsou přidané žádné účty hráčů.
              </p>
            ) : (
              <div className="space-y-2">
                {playerAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-all font-medium text-gray-900">{account.email}</p>
                      <p className="text-xs text-gray-500">
                        Přidáno: {new Date(account.created_at).toLocaleDateString('cs-CZ')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePlayerAccount(account.id, account.email)}
                      className="self-start rounded-md bg-red-100 px-3 py-1 text-sm text-red-700 hover:bg-red-200 sm:self-auto sm:shrink-0"
                    >
                      Smazat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </div>

        {/* Add Player */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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
                <label className="block text-sm font-medium text-gray-700">Ročník (rok narození, 4 číslice) *</label>
                <input
                  type="number"
                  name="player_rocnik"
                  required
                  min={2000}
                  max={2025}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Např. 2011"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Kategorie</label>
                <div className="mt-2 flex flex-wrap gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="player_category" value="U16" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">U16</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="player_category" value="U18" className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">U18</span>
                  </label>
                </div>
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
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3 md:items-end">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showDeletedPlayers}
                onChange={(e) => setShowDeletedPlayers(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">
                Zobrazit smazané hráče
              </span>
            </label>
          </div>
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

        <div className="mb-6 flex justify-end print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
          >
            Tisk / PDF
          </button>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <button
            type="button"
            onClick={() => toggleSection('manager.linkingOpen', setLinkingSectionOpen)}
            aria-expanded={linkingSectionOpen}
            className="flex w-full items-center gap-2 text-left"
          >
            <span
              className={`inline-block text-gray-500 transition-transform ${
                linkingSectionOpen ? 'rotate-90' : ''
              }`}
              aria-hidden="true"
            >
              ▸
            </span>
            <h2 className="text-xl font-semibold text-gray-900">
              Propojení rodičů{' '}
              <span className="text-sm font-normal text-gray-500">
                ({filteredPlayers.filter((p) => !p.parent_id).length} nepropojených ·{' '}
                {filteredPlayers.filter((p) => !!p.parent_id).length} připojených)
              </span>
            </h2>
          </button>
          {linkingSectionOpen && (
          <>
          <p className="mt-1 text-sm text-gray-600">
            Přepojení hráče je možné jen přes manažera: odpojit rodiče, potom vygenerovat nový
            kód.
          </p>
          <div className="mt-4 space-y-3">
            {filteredPlayers.length === 0 && filteredDeletedPlayers.length === 0 && (
              <p className="text-sm text-gray-500">Žádní hráči pro aktuální filtr.</p>
            )}
            {filteredDeletedPlayers.map((player) => {
              const isRestoring = restorePlayerLoadingId === player.id;
              return (
                <div
                  key={player.id}
                  className="rounded-md border border-gray-200 bg-gray-50 p-3 opacity-75"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-600">{player.name}</p>
                      <p className="text-xs text-gray-500">Smazáno</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRestorePlayer(player)}
                      disabled={isRestoring}
                      className="rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800 hover:bg-green-200 disabled:opacity-50"
                    >
                      {isRestoring ? 'Obnovuji…' : 'Obnovit'}
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredPlayers.map((player) => {
              const isLinked = !!player.parent_id;
              const isGenerating = generateCodeLoadingPlayerId === player.id;
              const isUnlinking = unlinkParentLoadingPlayerId === player.id;
              const showGeneratedCode = generatedCodeForPlayer?.playerId === player.id;
              return (
                <div
                  key={player.id}
                  className="rounded-md border border-gray-200 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{player.name}</p>
                      <p className="text-xs text-gray-600">
                        Stav rodiče:{' '}
                        <span
                          className={isLinked ? 'font-medium text-green-700' : 'font-medium text-amber-700'}
                        >
                          {isLinked ? 'Připojen' : 'Nepřipojen'}
                        </span>
                      </p>
                      {isLinked && (
                        <p className="text-xs text-gray-500">
                          Pro přepojení nejdřív odpoj rodiče.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {isLinked && (
                        <button
                          type="button"
                          onClick={() => handleUnlinkParent(player)}
                          disabled={isUnlinking || isGenerating}
                          className="rounded border border-red-300 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          {isUnlinking ? 'Odpojuji…' : 'Odpojit rodiče'}
                        </button>
                      )}
                      {!isLinked && (
                        <button
                          type="button"
                          onClick={() => handleGenerateParentCode(player.id)}
                          disabled={isGenerating || isUnlinking}
                          className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                        >
                          {isGenerating ? 'Generuji…' : 'Vygenerovat kód pro rodiče'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeletePlayer(player)}
                        disabled={isUnlinking || isGenerating || deletePlayerLoadingId === player.id}
                        className="rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        title="Skrýt hráče a jeho přihlášky (lze obnovit)"
                      >
                        {deletePlayerLoadingId === player.id ? 'Mažu…' : 'Smazat hráče'}
                      </button>
                    </div>
                  </div>
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
              );
            })}
          </div>
          </>
          )}
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

        {/* Matrix View – scroll uvnitř kontejneru, aby sticky hlavička (jména sloupců) fungovala */}
        <div className="max-h-[70vh] overflow-auto rounded-lg bg-white shadow print:hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="sticky left-0 top-0 z-30 bg-gray-50 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Turnaj
                </th>
                {filteredPlayers.map((player) => (
                  <th
                    key={player.id}
                    className="sticky top-0 z-20 bg-gray-50 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-gray-500"
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
                      <div className="font-medium">
                        {formatCompactTournamentLabel(
                          tournament.kategorie,
                          tournament.misto,
                          tournament.nazev
                        )}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(tournament.datum)}
                      </div>
                    </td>
                    {filteredPlayers.map((player) => {
                      const entry = tournamentEntries.find(
                        (e) => e.player_id === player.id
                      );
                      const isPlaying = entry && isActiveEntry(entry.status);
                      return (
                        <td
                          key={player.id}
                          className="px-4 py-3 text-center text-sm"
                        >
                          {isPlaying ? (
                            <div className="inline-flex flex-col items-center gap-1 rounded-md bg-blue-50 px-2 py-1">
                              <span className="text-base font-semibold text-blue-900">✓</span>
                              <span className="text-[10px] font-semibold text-blue-900">
                                P{entry!.priority}
                              </span>
                              {entry!.status === 'odehrano' ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnmarkAsPlayed(entry!.id)}
                                  className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800 hover:bg-amber-100"
                                >
                                  Zrušit odehráno
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleMarkAsPlayed(entry!.id)}
                                  className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700 hover:bg-green-200"
                                >
                                  Odehráno
                                </button>
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

        <div className="hidden print:block print-matrix">
          {Object.entries(tournamentsByWeek)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([weekNumber, weekTournaments]) => {
              if (!weekTournaments.length) return null;
              const weekRange = getWeekRange(weekTournaments[0].datum);

              return (
                <section
                  key={weekNumber}
                  className="print-week-section mb-4"
                >
                  <h2 className="mb-2 font-bold">
                    Týden {weekNumber} ({formatDate(weekRange.start)} - {formatDate(weekRange.end)})
                  </h2>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="w-[64px] border border-black px-1 py-0.5 text-left">
                          Datum
                        </th>
                        <th className="border border-black px-1 py-0.5 text-left">
                          Turnaj
                        </th>
                        {filteredPlayers.map((player) => (
                          <th
                            key={player.id}
                            className="border border-black px-1 py-0.5 text-center"
                          >
                            {formatShortPlayerName(player.name)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weekTournaments
                        .sort((a, b) => new Date(a.datum).getTime() - new Date(b.datum).getTime())
                        .map((tournament) => {
                          const tournamentEntries = entriesByTournament[tournament.id] || [];
                          return (
                            <tr key={tournament.id} className="print-row-avoid-break">
                              <td className="border border-black px-1 py-0.5 whitespace-nowrap">
                                {formatDate(tournament.datum)}
                              </td>
                              <td className="border border-black px-1 py-0.5">
                                {formatCompactTournamentLabel(tournament.kategorie, tournament.misto, tournament.nazev)}
                              </td>
                              {filteredPlayers.map((player) => {
                                const entry = tournamentEntries.find((e) => e.player_id === player.id);
                                const isPlaying =
                                  entry && (entry.status === 'planovano' || entry.status === 'odehrano');
                                return (
                                  <td
                                    key={player.id}
                                    className="border border-black px-1 py-0.5 text-center font-semibold"
                                  >
                                    {isPlaying ? '✓' : ''}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </section>
              );
            })}
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

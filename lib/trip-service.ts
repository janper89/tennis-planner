/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generic types often infer never for insert/update payloads */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export type Trip = Database['public']['Tables']['trip']['Row'];
export type TripInsert = Database['public']['Tables']['trip']['Insert'];
export type TripUpdate = Database['public']['Tables']['trip']['Update'];
export type TripPlayer = Database['public']['Tables']['trip_player']['Row'];

export type TripWithPlayers = Trip & {
  players: {
    id: string;
    name: string;
    birth_date: string;
  }[];
  tournament?: {
    id: string;
    nazev: string;
    misto: string;
    datum: string;
  } | null;
};

export interface TripFormValues {
  title: string;
  destination: string;
  start_at: string;
  end_at: string | null;
  tournament_id: string | null;
  transport: string | null;
  meeting_point: string | null;
  accommodation: string | null;
  cost_note: string | null;
  notes: string | null;
  status: 'planovano' | 'probiha' | 'ukonceno' | 'zruseno';
  player_ids: string[];
}

type Client = SupabaseClient<Database>;

/**
 * Nahraje všechny výjezdy, které aktuální uživatel může vidět (RLS se postará o filtraci).
 * Pro každý výjezd dotáhne přiřazené hráče (jméno + datum narození) a případně napojený turnaj.
 */
export async function fetchVisibleTrips(
  supabase: Client
): Promise<TripWithPlayers[]> {
  const { data: tripsRaw, error } = await supabase
    .from('trip')
    .select('*')
    .is('deleted_at', null)
    .order('start_at', { ascending: true });

  if (error) {
    console.error('fetchVisibleTrips - trip error', error);
    throw error;
  }
  const trips = (tripsRaw ?? []) as unknown as Trip[];
  if (trips.length === 0) return [];

  const tripIds = trips.map((t) => t.id);

  const { data: linksRaw, error: linkError } = await supabase
    .from('trip_player')
    .select('trip_id, player_id, player:player_id (id, name, birth_date)')
    .in('trip_id', tripIds);

  if (linkError) {
    console.error('fetchVisibleTrips - trip_player error', linkError);
    throw linkError;
  }
  const links = (linksRaw ?? []) as unknown as {
    trip_id: string;
    player_id: string;
    player: { id: string; name: string; birth_date: string } | null;
  }[];

  const tournamentIds = Array.from(
    new Set(trips.map((t) => t.tournament_id).filter(Boolean) as string[])
  );

  const tournamentMap: Record<
    string,
    { id: string; nazev: string; misto: string; datum: string }
  > = {};

  if (tournamentIds.length > 0) {
    const { data: tournaments } = await supabase
      .from('tournament')
      .select('id, nazev, misto, datum')
      .in('id', tournamentIds);
    const rows = (tournaments ?? []) as unknown as {
      id: string;
      nazev: string;
      misto: string;
      datum: string;
    }[];
    for (const t of rows) {
      tournamentMap[t.id] = t;
    }
  }

  const linksByTrip: Record<
    string,
    { id: string; name: string; birth_date: string }[]
  > = {};
  for (const l of links) {
    if (!l.player) continue;
    if (!linksByTrip[l.trip_id]) linksByTrip[l.trip_id] = [];
    linksByTrip[l.trip_id].push(l.player);
  }

  return trips.map((t) => ({
    ...t,
    players: (linksByTrip[t.id] || []).sort((a, b) =>
      a.name.localeCompare(b.name)
    ),
    tournament: t.tournament_id ? tournamentMap[t.tournament_id] ?? null : null,
  }));
}

/**
 * Vytvoří výjezd + přiřadí hráče. Volající musí dodat coach_id (ideálně vlastní app_user.id,
 * manager může zadat libovolného trenéra).
 */
export async function createTrip(
  supabase: Client,
  coachId: string,
  values: TripFormValues
): Promise<{ trip: Trip; playerIds: string[] }> {
  const payload: TripInsert = {
    coach_id: coachId,
    title: values.title.trim(),
    destination: values.destination.trim(),
    start_at: values.start_at,
    end_at: values.end_at || null,
    tournament_id: values.tournament_id || null,
    transport: values.transport?.trim() || null,
    meeting_point: values.meeting_point?.trim() || null,
    accommodation: values.accommodation?.trim() || null,
    cost_note: values.cost_note?.trim() || null,
    notes: values.notes?.trim() || null,
    status: values.status,
  };

  const { data: tripRaw, error } = await supabase
    .from('trip')
    .insert(payload as any)
    .select('*')
    .single();

  if (error || !tripRaw) {
    console.error('createTrip error', error);
    throw error ?? new Error('Nepodařilo se vytvořit výjezd');
  }
  const trip = tripRaw as unknown as Trip;

  if (values.player_ids.length > 0) {
    const rows = values.player_ids.map((pid) => ({
      trip_id: trip.id,
      player_id: pid,
    }));
    const { error: linkError } = await supabase
      .from('trip_player')
      .insert(rows as any);
    if (linkError) {
      console.error('createTrip - link error', linkError);
      throw linkError;
    }
  }

  return { trip, playerIds: values.player_ids };
}

/**
 * Upraví výjezd a sesynchronizuje přiřazení hráčů (diff přidat / odebrat).
 * Vrací seznam přidaných a odebraných hráčů pro notifikace.
 */
export async function updateTrip(
  supabase: Client,
  tripId: string,
  values: TripFormValues,
  currentPlayerIds: string[]
): Promise<{
  trip: Trip;
  addedPlayerIds: string[];
  removedPlayerIds: string[];
}> {
  const payload: TripUpdate = {
    title: values.title.trim(),
    destination: values.destination.trim(),
    start_at: values.start_at,
    end_at: values.end_at || null,
    tournament_id: values.tournament_id || null,
    transport: values.transport?.trim() || null,
    meeting_point: values.meeting_point?.trim() || null,
    accommodation: values.accommodation?.trim() || null,
    cost_note: values.cost_note?.trim() || null,
    notes: values.notes?.trim() || null,
    status: values.status,
  };

  const { data: tripRaw, error } = await supabase
    .from('trip')
    .update(payload as never)
    .eq('id', tripId)
    .select('*')
    .single();

  if (error || !tripRaw) {
    console.error('updateTrip error', error);
    throw error ?? new Error('Nepodařilo se upravit výjezd');
  }
  const trip = tripRaw as unknown as Trip;

  const currentSet = new Set(currentPlayerIds);
  const nextSet = new Set(values.player_ids);
  const toAdd = values.player_ids.filter((id) => !currentSet.has(id));
  const toRemove = currentPlayerIds.filter((id) => !nextSet.has(id));

  if (toAdd.length > 0) {
    const rows = toAdd.map((pid) => ({ trip_id: tripId, player_id: pid }));
    const { error: addError } = await supabase
      .from('trip_player')
      .insert(rows as any);
    if (addError) {
      console.error('updateTrip - add players error', addError);
      throw addError;
    }
  }
  if (toRemove.length > 0) {
    const { error: delError } = await supabase
      .from('trip_player')
      .delete()
      .eq('trip_id', tripId)
      .in('player_id', toRemove);
    if (delError) {
      console.error('updateTrip - remove players error', delError);
      throw delError;
    }
  }

  return {
    trip,
    addedPlayerIds: toAdd,
    removedPlayerIds: toRemove,
  };
}

/**
 * Soft delete – označí výjezd jako smazaný (deleted_at).
 */
export async function deleteTrip(
  supabase: Client,
  tripId: string
): Promise<void> {
  const { error } = await supabase
    .from('trip')
    .update({ deleted_at: new Date().toISOString() } as never)
    .eq('id', tripId);
  if (error) {
    console.error('deleteTrip error', error);
    throw error;
  }
}

export type TripNotificationKind = 'created' | 'updated' | 'added' | 'removed' | 'cancelled';

/**
 * Zavolá API endpoint pro odeslání e-mailů rodičům / hráčům.
 * Selhání notifikací nesmí shodit hlavní akci, takže errors jen logujeme.
 */
export async function notifyTripChange(
  tripId: string,
  kind: TripNotificationKind,
  playerIds: string[]
): Promise<void> {
  if (!playerIds || playerIds.length === 0) return;
  try {
    const res = await fetch('/api/trips/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tripId, kind, playerIds }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('notifyTripChange - response not ok', res.status, text);
    }
  } catch (err) {
    console.warn('notifyTripChange - fetch failed', err);
  }
}

export function formatTripDateRange(startAt: string, endAt: string | null): string {
  const start = new Date(startAt);
  const hasTime = startAt.includes('T');
  const startStr = start.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
  if (!endAt) return startStr;
  const end = new Date(endAt);
  const endStr = end.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    ...(endAt.includes('T') ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
  return `${startStr} – ${endStr}`;
}

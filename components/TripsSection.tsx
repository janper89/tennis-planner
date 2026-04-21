'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  createTrip,
  deleteTrip,
  fetchVisibleTrips,
  formatTripDateRange,
  notifyTripChange,
  updateTrip,
  type TripFormValues,
  type TripWithPlayers,
} from '@/lib/trip-service';
import type { Database } from '@/types/database';

type Player = Pick<
  Database['public']['Tables']['player']['Row'],
  'id' | 'name' | 'birth_date'
>;
type Tournament = Pick<
  Database['public']['Tables']['tournament']['Row'],
  'id' | 'nazev' | 'misto' | 'datum'
>;

export type TripsMode = 'coach' | 'manager' | 'readonly';

interface TripsSectionProps {
  mode: TripsMode;
  /**
   * app_user.id aktuálního uživatele.
   * Pro coach se použije jako coach_id při vytváření.
   */
  currentUserId: string;
  /**
   * Seznam hráčů, které lze přidávat do výjezdu (u coach: jeho hráči, u manager: všichni).
   * U readonly (rodič/hráč) není potřeba.
   */
  assignablePlayers?: Player[];
  /**
   * Seznam turnajů z DB pro případné propojení výjezdu s turnajem.
   */
  tournaments?: Tournament[];
}

const EMPTY_FORM: TripFormValues = {
  title: '',
  destination: '',
  start_at: '',
  end_at: null,
  tournament_id: null,
  transport: null,
  meeting_point: null,
  accommodation: null,
  cost_note: null,
  notes: null,
  status: 'planovano',
  player_ids: [],
};

function toLocalDateTimeInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function TripsSection({
  mode,
  currentUserId,
  assignablePlayers = [],
  tournaments = [],
}: TripsSectionProps) {
  const supabase = useMemo(() => createClient(), []);
  const [trips, setTrips] = useState<TripWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTrip, setEditingTrip] = useState<TripWithPlayers | null>(null);
  const [form, setForm] = useState<TripFormValues>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  /** null = ještě nezkontrolováno (nebo chyba fetch), false = Resend není nastaven */
  const [tripEmailsEnabled, setTripEmailsEnabled] = useState<boolean | null>(null);

  const canEdit = mode === 'coach' || mode === 'manager';

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchVisibleTrips(supabase);
      setTrips(data);
    } catch (err) {
      console.error(err);
      setError('Nepodařilo se načíst výjezdy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/trips/email-status');
        if (!res.ok) return;
        const data = (await res.json()) as { emailsEnabled?: boolean };
        if (!cancelled) setTripEmailsEnabled(Boolean(data.emailsEnabled));
      } catch {
        if (!cancelled) setTripEmailsEnabled(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  const now = new Date();
  const { upcoming, past } = useMemo(() => {
    const upcoming: TripWithPlayers[] = [];
    const past: TripWithPlayers[] = [];
    for (const t of trips) {
      const ref = t.end_at ? new Date(t.end_at) : new Date(t.start_at);
      if (ref >= now) upcoming.push(t);
      else past.push(t);
    }
    return { upcoming, past };
  }, [trips]); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditingTrip(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError(null);
  };

  const openEdit = (trip: TripWithPlayers) => {
    setEditingTrip(trip);
    setForm({
      title: trip.title,
      destination: trip.destination,
      start_at: toLocalDateTimeInputValue(trip.start_at),
      end_at: trip.end_at ? toLocalDateTimeInputValue(trip.end_at) : null,
      tournament_id: trip.tournament_id,
      transport: trip.transport,
      meeting_point: trip.meeting_point,
      accommodation: trip.accommodation,
      cost_note: trip.cost_note,
      notes: trip.notes,
      status: trip.status,
      player_ids: trip.players.map((p) => p.id),
    });
    setShowForm(true);
    setError(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingTrip(null);
    setForm(EMPTY_FORM);
    setError(null);
  };

  const handleTournamentPicked = (tournamentId: string) => {
    if (!tournamentId) {
      setForm((f) => ({ ...f, tournament_id: null }));
      return;
    }
    const t = tournaments.find((x) => x.id === tournamentId);
    if (!t) return;
    setForm((f) => ({
      ...f,
      tournament_id: t.id,
      title: f.title || `Výjezd – ${t.nazev}`,
      destination: f.destination || t.misto,
      start_at: f.start_at || `${t.datum}T08:00`,
    }));
  };

  const togglePlayer = (playerId: string) => {
    setForm((f) => {
      const has = f.player_ids.includes(playerId);
      return {
        ...f,
        player_ids: has
          ? f.player_ids.filter((id) => id !== playerId)
          : [...f.player_ids, playerId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!form.title.trim()) {
      setError('Vyplň název výjezdu.');
      return;
    }
    if (!form.destination.trim()) {
      setError('Vyplň destinaci.');
      return;
    }
    if (!form.start_at) {
      setError('Vyplň datum a čas odjezdu.');
      return;
    }
    if (form.end_at && new Date(form.end_at) < new Date(form.start_at)) {
      setError('Návrat musí být po odjezdu.');
      return;
    }
    if (form.player_ids.length === 0) {
      setError('Přiřaď alespoň jednoho hráče.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingTrip) {
        const previousIds = editingTrip.players.map((p) => p.id);
        const { addedPlayerIds, removedPlayerIds } = await updateTrip(
          supabase,
          editingTrip.id,
          form,
          previousIds
        );
        const stayed = form.player_ids.filter(
          (id) => !addedPlayerIds.includes(id)
        );
        if (stayed.length > 0) {
          void notifyTripChange(editingTrip.id, 'updated', stayed);
        }
        if (addedPlayerIds.length > 0) {
          void notifyTripChange(editingTrip.id, 'added', addedPlayerIds);
        }
        if (removedPlayerIds.length > 0) {
          void notifyTripChange(editingTrip.id, 'removed', removedPlayerIds);
        }
      } else {
        const coachIdForTrip = currentUserId;
        const { trip, playerIds } = await createTrip(
          supabase,
          coachIdForTrip,
          form
        );
        void notifyTripChange(trip.id, 'created', playerIds);
      }
      closeForm();
      await load();
    } catch (err) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : 'Nepodařilo se uložit výjezd.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (trip: TripWithPlayers) => {
    const ok = confirm(
      `Smazat výjezd „${trip.title}"? Rodiče přiřazených hráčů dostanou upozornění.`
    );
    if (!ok) return;
    try {
      await deleteTrip(supabase, trip.id);
      const playerIds = trip.players.map((p) => p.id);
      if (playerIds.length > 0) {
        void notifyTripChange(trip.id, 'cancelled', playerIds);
      }
      await load();
    } catch (err) {
      console.error(err);
      alert('Nepodařilo se smazat výjezd.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Výjezdy</h2>
          <p className="text-sm text-gray-600">
            {canEdit
              ? tripEmailsEnabled === false
                ? 'Vytvoř výjezd a přiřaď hráče — výjezd se uloží v aplikaci. E-maily rodičům zapneš později (viz žlutý box níže).'
                : 'Vytvoř výjezd, přiřaď hráče a rodičům přijde informace e-mailem.'
              : 'Zde se zobrazují výjezdy, na které je hráč přiřazený.'}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <span aria-hidden>🧳</span>
            <span>Nový výjezd</span>
          </button>
        )}
      </div>

      {canEdit && tripEmailsEnabled === false && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          <p className="font-medium">E-maily zatím nejsou zapnuté</p>
          <p className="mt-1 text-amber-900">
            Aby rodiče (a self-managed hráči) dostávali upozornění při výjezdu, doplníš později
            proměnné prostředí{' '}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">RESEND_API_KEY</code> a{' '}
            <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">RESEND_FROM_EMAIL</code>{' '}
            do souboru <code className="rounded bg-amber-100/80 px-1 py-0.5 text-xs">.env.local</code>{' '}
            (lokálně) a do nastavení projektu na Vercelu (produkce), pak restart dev serveru nebo
            redeploy. Do té doby výjezdy fungují normálně, jen se maily neposílají.
          </p>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Načítání výjezdů…</p>}

      {!loading && trips.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center">
          <p className="text-gray-600">Zatím nejsou žádné výjezdy.</p>
          {canEdit && (
            <button
              onClick={openCreate}
              className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Založit první výjezd
            </button>
          )}
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Nadcházející
          </h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {upcoming.map((t) => (
              <TripCard
                key={t.id}
                trip={t}
                canEdit={canEdit}
                onEdit={() => openEdit(t)}
                onDelete={() => handleDelete(t)}
              />
            ))}
          </div>
        </section>
      )}

      {!loading && past.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
              Proběhlé ({past.length})
            </h3>
            <button
              onClick={() => setShowPast((v) => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showPast ? 'Skrýt' : 'Zobrazit'}
            </button>
          </div>
          {showPast && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {past.map((t) => (
                <TripCard
                  key={t.id}
                  trip={t}
                  canEdit={canEdit}
                  onEdit={() => openEdit(t)}
                  onDelete={() => handleDelete(t)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {showForm && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold">
                {editingTrip ? 'Upravit výjezd' : 'Nový výjezd'}
              </h3>
              <button
                onClick={closeForm}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                aria-label="Zavřít"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Název *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  placeholder="Např. Výjezd Plzeň TE J60"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              {tournaments.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Navázat na turnaj (volitelné)
                  </label>
                  <select
                    value={form.tournament_id ?? ''}
                    onChange={(e) => handleTournamentPicked(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  >
                    <option value="">— Bez turnaje —</option>
                    {tournaments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nazev} ({t.misto}) – {t.datum}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Destinace *
                </label>
                <input
                  type="text"
                  value={form.destination}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, destination: e.target.value }))
                  }
                  placeholder="Místo / adresa"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Odjezd *
                  </label>
                  <input
                    type="datetime-local"
                    value={form.start_at}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_at: e.target.value }))
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Návrat
                  </label>
                  <input
                    type="datetime-local"
                    value={form.end_at ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        end_at: e.target.value || null,
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Doprava
                  </label>
                  <input
                    type="text"
                    value={form.transport ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        transport: e.target.value || null,
                      }))
                    }
                    placeholder="Např. auto trenéra, vlak 8:15"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Sraz
                  </label>
                  <input
                    type="text"
                    value={form.meeting_point ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        meeting_point: e.target.value || null,
                      }))
                    }
                    placeholder="Místo a čas srazu"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Ubytování
                  </label>
                  <input
                    type="text"
                    value={form.accommodation ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        accommodation: e.target.value || null,
                      }))
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Orientační cena
                  </label>
                  <input
                    type="text"
                    value={form.cost_note ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        cost_note: e.target.value || null,
                      }))
                    }
                    placeholder="Např. 2 500 Kč / hráč"
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Poznámky (co s sebou, program…)
                </label>
                <textarea
                  value={form.notes ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value || null }))
                  }
                  rows={3}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Stav
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as TripFormValues['status'],
                    }))
                  }
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="planovano">Plánovaný</option>
                  <option value="probiha">Probíhá</option>
                  <option value="ukonceno">Ukončený</option>
                  <option value="zruseno">Zrušený</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Hráči *
                </label>
                {assignablePlayers.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-500">
                    Nejsou dostupní žádní hráči k přiřazení.
                  </p>
                ) : (
                  <div className="mt-2 max-h-52 overflow-y-auto rounded-md border border-gray-200 p-2">
                    {assignablePlayers.map((p) => (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={form.player_ids.includes(p.id)}
                          onChange={() => togglePlayer(p.id)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {p.name}{' '}
                          <span className="text-xs text-gray-400">
                            ({new Date(p.birth_date).getFullYear()})
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Vybraní hráči uvidí výjezd u sebe v profilu, jejich rodičům
                  dorazí e-mail.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting
                    ? 'Ukládám…'
                    : editingTrip
                      ? 'Uložit změny'
                      : 'Vytvořit výjezd'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface TripCardProps {
  trip: TripWithPlayers;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function TripCard({ trip, canEdit, onEdit, onDelete }: TripCardProps) {
  return (
    <article className="flex flex-col rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold text-gray-900">
            {trip.title}
          </h4>
          <p className="text-sm text-gray-600">
            {trip.destination}
            {trip.tournament?.nazev && (
              <span className="ml-2 text-xs text-gray-400">
                · {trip.tournament.nazev}
              </span>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(
            trip.status
          )}`}
        >
          {statusLabel(trip.status)}
        </span>
      </header>

      <dl className="mt-3 space-y-1 text-sm text-gray-700">
        <div>
          <dt className="inline text-gray-500">Termín: </dt>
          <dd className="inline">
            {formatTripDateRange(trip.start_at, trip.end_at)}
          </dd>
        </div>
        {trip.transport && (
          <div>
            <dt className="inline text-gray-500">Doprava: </dt>
            <dd className="inline">{trip.transport}</dd>
          </div>
        )}
        {trip.meeting_point && (
          <div>
            <dt className="inline text-gray-500">Sraz: </dt>
            <dd className="inline">{trip.meeting_point}</dd>
          </div>
        )}
        {trip.accommodation && (
          <div>
            <dt className="inline text-gray-500">Ubytování: </dt>
            <dd className="inline">{trip.accommodation}</dd>
          </div>
        )}
        {trip.cost_note && (
          <div>
            <dt className="inline text-gray-500">Cena: </dt>
            <dd className="inline">{trip.cost_note}</dd>
          </div>
        )}
        {trip.notes && (
          <div>
            <dt className="inline text-gray-500">Poznámka: </dt>
            <dd className="inline whitespace-pre-wrap">{trip.notes}</dd>
          </div>
        )}
      </dl>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          Hráči ({trip.players.length})
        </p>
        <p className="text-sm text-gray-700">
          {trip.players.length === 0
            ? '—'
            : trip.players.map((p) => p.name).join(', ')}
        </p>
      </div>

      {canEdit && (
        <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
          <button
            onClick={onEdit}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
          >
            Upravit
          </button>
          <button
            onClick={onDelete}
            className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Smazat
          </button>
        </div>
      )}
    </article>
  );
}

function statusLabel(s: string): string {
  switch (s) {
    case 'planovano':
      return 'Plánovaný';
    case 'probiha':
      return 'Probíhá';
    case 'ukonceno':
      return 'Ukončený';
    case 'zruseno':
      return 'Zrušený';
    default:
      return s;
  }
}

function statusClass(s: string): string {
  switch (s) {
    case 'planovano':
      return 'bg-blue-100 text-blue-800';
    case 'probiha':
      return 'bg-green-100 text-green-800';
    case 'ukonceno':
      return 'bg-gray-100 text-gray-700';
    case 'zruseno':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

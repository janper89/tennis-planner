import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const FROM_ADDRESS = process.env.RESEND_FROM_EMAIL || 'Tenisový klub <noreply@janperutka.com>';

type Kind = 'created' | 'updated' | 'added' | 'removed' | 'cancelled';

interface NotifyBody {
  tripId: string;
  kind: Kind;
  playerIds: string[];
}

function formatDateRange(startAt: string, endAt: string | null): string {
  const start = new Date(startAt);
  const startStr = start.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!endAt) return startStr;
  const end = new Date(endAt);
  const endStr = end.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${startStr} – ${endStr}`;
}

function subjectFor(kind: Kind, title: string): string {
  switch (kind) {
    case 'created':
      return `Nový výjezd: ${title}`;
    case 'updated':
      return `Úprava výjezdu: ${title}`;
    case 'added':
      return `Zařazení na výjezd: ${title}`;
    case 'removed':
      return `Odhlášení z výjezdu: ${title}`;
    case 'cancelled':
      return `Zrušení výjezdu: ${title}`;
  }
}

function introFor(kind: Kind, playerNames: string): string {
  switch (kind) {
    case 'created':
      return `Trenér vytvořil nový výjezd, na který jede ${playerNames}.`;
    case 'updated':
      return `Trenér upravil detaily výjezdu, kterého se účastní ${playerNames}.`;
    case 'added':
      return `${playerNames} byl(a) zařazen(a) na tento výjezd.`;
    case 'removed':
      return `${playerNames} už na tento výjezd nejede.`;
    case 'cancelled':
      return `Výjezd, na kterém se měl(a) účastnit ${playerNames}, byl zrušen.`;
  }
}

function buildHtml(params: {
  kind: Kind;
  playerNames: string;
  title: string;
  destination: string;
  dateRange: string;
  transport: string | null;
  meetingPoint: string | null;
  accommodation: string | null;
  costNote: string | null;
  notes: string | null;
}): string {
  const {
    kind,
    playerNames,
    title,
    destination,
    dateRange,
    transport,
    meetingPoint,
    accommodation,
    costNote,
    notes,
  } = params;

  const row = (label: string, value: string | null) =>
    value
      ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;vertical-align:top;">${label}</td><td style="padding:4px 0;color:#111827;">${value}</td></tr>`
      : '';

  return `
  <div style="font-family: -apple-system, 'Segoe UI', sans-serif; color:#111827; max-width:560px; margin:0 auto; padding:24px;">
    <h2 style="margin:0 0 12px 0;">${title}</h2>
    <p style="margin:0 0 16px 0; color:#374151;">${introFor(kind, playerNames)}</p>
    <table style="border-collapse:collapse; font-size:14px; margin-bottom:16px;">
      ${row('Destinace', destination)}
      ${row('Termín', dateRange)}
      ${row('Doprava', transport)}
      ${row('Sraz', meetingPoint)}
      ${row('Ubytování', accommodation)}
      ${row('Náklady', costNote)}
      ${row('Poznámka', notes)}
    </table>
    <p style="margin:24px 0 0 0; color:#6b7280; font-size:12px;">
      Tento e-mail byl odeslán automaticky z tenisové aplikace.
    </p>
  </div>`;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn('[trips/notify] RESEND_API_KEY není nastaven – e-maily se neposílají.');
      return NextResponse.json({ ok: true, skipped: 'no-api-key' });
    }

    const body = (await req.json()) as NotifyBody;
    const { tripId, kind, playerIds } = body || {};

    if (!tripId || !kind || !Array.isArray(playerIds)) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    if (playerIds.length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no-players' });
    }

    const supabase = await createClient();

    // Ověření – jen přihlášený uživatel může volat notifikace.
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: trip, error: tripErr } = await supabase
      .from('trip')
      .select('*')
      .eq('id', tripId)
      .maybeSingle();

    if (tripErr || !trip) {
      console.warn('[trips/notify] trip nenalezen', tripErr);
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    const { data: players, error: playersErr } = await supabase
      .from('player')
      .select('id, name, parent_id, self_managed_by')
      .in('id', playerIds);

    if (playersErr) {
      console.warn('[trips/notify] players error', playersErr);
      return NextResponse.json({ error: 'Players error' }, { status: 500 });
    }

    // Sesbírej app_user.id pro rodiče a self-managed hráče
    const appUserIds = Array.from(
      new Set(
        (players || [])
          .flatMap((p) => [p.parent_id, p.self_managed_by])
          .filter(Boolean) as string[]
      )
    );

    const emailsToPlayers: Record<string, string[]> = {};

    if (appUserIds.length > 0) {
      const { data: users, error: usersErr } = await supabase
        .from('app_user')
        .select('id, email')
        .in('id', appUserIds);

      if (usersErr) {
        console.warn('[trips/notify] users error', usersErr);
        return NextResponse.json({ error: 'Users error' }, { status: 500 });
      }

      const userMap = new Map((users || []).map((u) => [u.id, u.email]));

      for (const p of players || []) {
        for (const uid of [p.parent_id, p.self_managed_by]) {
          if (!uid) continue;
          const email = userMap.get(uid);
          if (!email) continue;
          if (!emailsToPlayers[email]) emailsToPlayers[email] = [];
          emailsToPlayers[email].push(p.name);
        }
      }
    }

    if (Object.keys(emailsToPlayers).length === 0) {
      return NextResponse.json({ ok: true, skipped: 'no-emails' });
    }

    const resend = new Resend(apiKey);
    const dateRange = formatDateRange(trip.start_at, trip.end_at);
    const subject = subjectFor(kind, trip.title);

    const sendResults = await Promise.allSettled(
      Object.entries(emailsToPlayers).map(([email, names]) => {
        const playerNames = Array.from(new Set(names)).join(', ');
        const html = buildHtml({
          kind,
          playerNames,
          title: trip.title,
          destination: trip.destination,
          dateRange,
          transport: trip.transport,
          meetingPoint: trip.meeting_point,
          accommodation: trip.accommodation,
          costNote: trip.cost_note,
          notes: trip.notes,
        });
        return resend.emails.send({
          from: FROM_ADDRESS,
          to: email,
          subject,
          html,
        });
      })
    );

    const failed = sendResults.filter((r) => r.status === 'rejected').length;
    return NextResponse.json({
      ok: true,
      sent: sendResults.length - failed,
      failed,
    });
  } catch (err) {
    console.error('[trips/notify] unexpected', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

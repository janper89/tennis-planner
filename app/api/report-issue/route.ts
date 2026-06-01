import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const FROM_ADDRESS =
  process.env.RESEND_FROM_EMAIL || 'Tenisový klub <noreply@janperutka.com>';
const DESTINATION_EMAIL = 'perutka89@gmail.com';

type ReportType = 'missing_tournament' | 'other';

interface ReportIssueBody {
  reportType: ReportType;
  profileLabel: string;
  reporterEmail?: string;
  missingTournament?: {
    date: string;
    category: string;
    name: string;
  } | null;
  otherDescription?: string | null;
}

function buildHtml(body: ReportIssueBody, authEmail: string): string {
  const safe = (value: string | null | undefined) =>
    String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');

  const rows: string[] = [
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Profil</td><td style="padding:4px 0;color:#111827;">${safe(body.profileLabel)}</td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Uživatel</td><td style="padding:4px 0;color:#111827;">${safe(authEmail)}</td></tr>`,
    `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Form e-mail</td><td style="padding:4px 0;color:#111827;">${safe(body.reporterEmail || authEmail)}</td></tr>`,
  ];

  if (body.reportType === 'missing_tournament' && body.missingTournament) {
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Typ</td><td style="padding:4px 0;color:#111827;">Chybějící turnaj</td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Datum</td><td style="padding:4px 0;color:#111827;">${safe(body.missingTournament.date)}</td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Kategorie</td><td style="padding:4px 0;color:#111827;">${safe(body.missingTournament.category)}</td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Název</td><td style="padding:4px 0;color:#111827;">${safe(body.missingTournament.name)}</td></tr>`
    );
  } else {
    rows.push(
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Typ</td><td style="padding:4px 0;color:#111827;">Další chyba</td></tr>`,
      `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Popis</td><td style="padding:4px 0;color:#111827;white-space:pre-wrap;">${safe(body.otherDescription)}</td></tr>`
    );
  }

  return `
    <div style="font-family:-apple-system,'Segoe UI',sans-serif;color:#111827;max-width:640px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 12px 0;">Nahlášení chyby z Tennis Club</h2>
      <table style="border-collapse:collapse;font-size:14px;">
        ${rows.join('\n')}
      </table>
    </div>
  `;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chybí RESEND_API_KEY v prostředí.' },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as ReportIssueBody;
    if (!body?.profileLabel || !body?.reportType) {
      return NextResponse.json({ error: 'Neplatná data formuláře.' }, { status: 400 });
    }

    if (body.reportType === 'missing_tournament') {
      const item = body.missingTournament;
      if (!item?.date || !item?.category?.trim() || !item?.name?.trim()) {
        return NextResponse.json(
          { error: 'Pro chybějící turnaj vyplň datum, kategorii a název.' },
          { status: 400 }
        );
      }
    } else if (!body.otherDescription?.trim()) {
      return NextResponse.json(
        { error: 'Pro další chybu vyplň popis.' },
        { status: 400 }
      );
    }

    const resend = new Resend(apiKey);
    const subject =
      body.reportType === 'missing_tournament'
        ? `Tennis Club: chybějící turnaj (${body.profileLabel})`
        : `Tennis Club: nahlášení chyby (${body.profileLabel})`;

    await resend.emails.send({
      from: FROM_ADDRESS,
      to: DESTINATION_EMAIL,
      replyTo: user.email,
      subject,
      html: buildHtml(body, user.email),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[report-issue] unexpected', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

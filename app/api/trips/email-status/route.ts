import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Vrací jen informaci, zda je na serveru nastavený Resend API klíč (bez úniku hodnoty).
 * Klient ji použije k zobrazení upozornění ve Výjezdech pro trenéra/manažera.
 */
export async function GET() {
  return NextResponse.json({
    emailsEnabled: Boolean(process.env.RESEND_API_KEY?.trim()),
  });
}

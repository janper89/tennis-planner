# Nahlášení chyby z aplikace

Uživatelé (rodič, trenér, hráč, manažer) mohou z hlavičky dashboardu nahlásit problém s turnajovými daty.

## Co umí formulář

1. **Chybějící turnaj** — datum, kategorie, název turnaje (povinné).
2. **Další chyba** — volný popis.

## Kam to jde

- E-mail na **perutka89@gmail.com** (hardcoded v `app/api/report-issue/route.ts`).
- Odesílá **Resend** (`RESEND_API_KEY`).

## Produkce (Vercel)

| Proměnná | Příklad |
|----------|---------|
| `RESEND_API_KEY` | `re_...` z Resend dashboardu |
| `RESEND_FROM_EMAIL` | `Tenisový klub <noreply@janperutka.com>` |

Doména v `RESEND_FROM_EMAIL` musí být **Verified** v Resend (stejně jako u resetu hesla).

Po přidání/změně env: **Deployments → Redeploy** (Production).

## Ověření

1. Přihlásit se v produkci → **Nahlášení chyby** → odeslat test.
2. Zkontrolovat inbox a Resend → **Logs** (stav může být Sent i bez Delivered — mail v inboxu stačí).

## Kód

- UI: `components/ErrorReportButton.tsx` (vloženo do všech dashboardů).
- API: `app/api/report-issue/route.ts` (vyžaduje přihlášeného uživatele).

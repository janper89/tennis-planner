# CLAUDE.md — Tennis Club (Tennis Planner)

> Next.js aplikace pro plánování turnajových výjezdů — rodiče, trenéři, manažeři.
> Toto je "Tennis Planner" z projektové karty — repo se jmenuje tennis-club.

---

## Stack

- **Frontend**: Next.js 16 + React 19 + TypeScript + Tailwind CSS + App Router
- **Backend/DB**: Supabase (PostgreSQL, RLS, auth přes magic link)
- **Deploy**: Vercel
- **Repo**: github.com/janper89/tennis-club
- **Dev**: `npm run dev` → http://localhost:3000
- **E-mail**: Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
- **CI**: GitHub Actions — turnajová cache 1× měsíčně

---

## Struktura projektu

```
app/
  (auth)/login/           ← magic link login
  parent/ coach/ manager/ player/
  trips/
  api/report-issue/       ← nahlášení chyby (Resend)
components/
  ErrorReportButton.tsx
lib/
  supabase/               ← client.ts + server.ts (NEUPRAVUJ bez důvodu)
  config.ts               ← ADMIN_EMAILS, role konfigurace
scripts/
  import-tournament-cache.js
  refresh-tournaments.sh
  fetch-calendar-itf-juniors.js
.github/workflows/
  update-tournament-cache.yml
```

---

## Aktuální stav

**Status**: V provozu — aktivní vývoj  
**Poslední změna**: 2026-06-01 — cache 4 měsíce, CI fix, nahlášení chyby

- [x] Auth (magic link), role: rodič / trenér / manažer / hráč
- [x] Dashboard pro každou roli
- [x] Tournament cache (ITF JSON API), horizont **4 měsíce**
- [x] GitHub Actions: měsíční obnova cache (full M1–M4, pak +1 měsíc)
- [x] Nahlášení chyby z profilů → e-mail adminovi (Resend)
- [x] Výjezdy + notifikace e-mailem (Resend)
- [x] Tisk: minimal tournament mode, 3 týdny na A4
- [ ] AI doporučení výjezdů [plánováno]
- [ ] Responsivita — [DOPLNIT stav]

---

## Gotchas — přečti před každou změnou

**Turnajová cache:**
- Default horizont: **`CACHE_WINDOW_MONTHS_SEARCH=4`** (skripty + CI).
- **`fetch-calendar-itf-juniors.js YYYY-MM`** bez `--months=1` stáhne celý horizont (4 měsíce) od daného měsíce — v CI vždy `--months=1` pro jeden kalendářní měsíc.
- **`import-tournament-cache.js`** defaultně upsert only. `--cleanup` / `--replace-all` jsou destruktivní.
- Import odmítne batch s méně než 20 řádky (ochrana proti neúplnému scrapu).

**Supabase / RLS:**
- Nová tabulka = RLS ON → přidat policy. SQL v `supabase/` není auto-migrace.
- **Výjezdy (`trip` / `trip_player`):** politiky se nesmí křížově dotazovat přes `EXISTS` (42P17 infinite recursion). Oprava: `supabase/fix_trip_rls_recursion.sql`. Detail: vault `Memory/tennis-club/bugfixes/2026-06-01_trip-rls-infinite-recursion.md`.
- Dva klienty: `lib/supabase/client.ts` vs `server.ts`.
- Magic link redirect URL v Supabase Dashboard.

**Vercel / Resend:**
- Po změně env proměnných vždy **Redeploy** Production.
- `RESEND_FROM_EMAIL` musí být z ověřené domény (např. `Tenisový klub <noreply@janperutka.com>`).

---

## Role systém

| Role | Route | Co vidí |
|------|-------|---------|
| `parent` | `/parent` | výjezdy dítěte, turnaje |
| `coach` | `/coach` | hráči, plánování |
| `manager` | `/manager` | admin, uživatelé |
| `player` | `/player` | vlastní profil |

Admin (email v `config.ts`) může přepínat mezi rolemi.

---

## Kde najít víc kontextu

- Automatická obnova turnajů: `docs/automaticka-obnova-turnaju.md`
- Nahlášení chyby: `docs/nahlaseni-chyby.md`
- Troubleshooting: `docs/TROUBLESHOOTING-TURNAJE.md`
- Resend + Supabase auth: `docs/nastaveni-resend-a-supabase-kroky.md`
- Projektová karta (vault): `Projekty/_system/projects/tennis-planner.md`
- Memory (vault): `Memory/tennis-club/`

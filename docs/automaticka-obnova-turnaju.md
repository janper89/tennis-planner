# Automatická obnova turnajového plánu

Turnajová cache (vyhledávání turnajů v aplikaci) se **obnovuje automaticky každý měsíc** – nemusíš na to myslet.

## Jak to funguje

- **Kdy:** 1. den v měsíci ve **4:00 UTC** (v zimě 5:00 SEČ, v létě 6:00 SELČ).
- **Co se stane:** GitHub Actions stáhne kalendář ITF Juniors na **4 měsíce dopředu**, sloučí data a naimportuje je do Supabase do tabulky `tournament_cache`. V DB zůstane vždy jen okno „od dneška + 4 měsíce“ (starší turnaje z cache zmizí).
- **Tabulka `tournament`** (turnaje, na které už jsou přihlášky) se **nemění** – ty zůstávají. Mění se jen vyhledávací cache.

## Co potřebuješ mít nastavené (jednou)

V repozitáři na **GitHubu** → **Settings** → **Secrets and variables** → **Actions** přidej dva secrets:

| Secret | Kde to vzít |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role (ne anon key) |

Bez těchto secrets se workflow nespustí (nebo spadne na kroku Import).

## Ruční spuštění

Kdybys chtěl obnovit cache hned (nečekat na 1. v měsíci):

1. GitHub → tvůj repozitář → **Actions**
2. Vlevo vyber workflow **„Update tournament cache (4 months)“**
3. **Run workflow** → Run workflow

## Kde je to nakonfigurované

- Workflow: `.github/workflows/update-tournament-cache.yml`
- Detaily importu: `scripts/import-tournament-cache.js` (parametry `--from-today --window-months=4 --replace-all`)

# Nasazení na web (Vercel)

Aplikace běží na localhostu. Aby ji měl k dispozici kdokoli na internetu, nasaď ji na Vercel (zdarma pro Next.js).

## 1. Kód na GitHubu

Projekt musí být v Git repozitáři (lokálně už pravděpodobně je). Nahraj ho na GitHub:

```bash
cd "/Users/janperutka/Desktop/AI mozek/Projekty/tennis-club"
git remote -v   # zkontroluj, jestli už máš origin
# Pokud ne:
# git remote add origin https://github.com/TVE_USERNAME/tennis-club.git
git add .
git commit -m "Připraveno k nasazení"
git push -u origin main
```

(Vytvoř si na [github.com](https://github.com) repozitář „tennis-club“ a podle návodu tam kód pushni.)

## 2. Vercel účet a import projektu

1. Jdi na [vercel.com](https://vercel.com) a přihlas se (ideálně přes GitHub).
2. **Add New…** → **Project**.
3. **Import** repozitáře `tennis-club` z GitHubu.
4. Nech výchozí nastavení (Framework: Next.js, Root Directory: `.`) a klikni **Deploy**. První build může skončit chybou kvůli chybějícím env proměnným – to vyřešíš v kroku 3.

## 3. Environment proměnné na Vercelu

1. V projektu na Vercelu: **Settings** → **Environment Variables**.
2. Přidej (hodnoty zkopíruj z lokálního `.env.local`):

   | Name                         | Value                    | Environment |
   | ---------------------------- | ------------------------ | ----------- |
   | `NEXT_PUBLIC_SUPABASE_URL`   | `https://xxx.supabase.co`| Production, Preview |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | tvůj anon key         | Production, Preview |

3. Ulož a spusť **Redeploy** (Deployments → u posledního buildu ⋮ → Redeploy).

## 4. Supabase – URL pro produkci

Aby přihlášení (magic link) na webovce fungovalo, musí Supabase znát produkční adresu:

1. [Supabase Dashboard](https://supabase.com/dashboard) → tvůj projekt → **Authentication** → **URL Configuration**.
2. **Site URL**: nastav na adresu od Vercelu, např. `https://tennis-club-xxx.vercel.app` (nebo vlastní doména).
3. Do **Redirect URLs** přidej:
   - `https://tennis-club-xxx.vercel.app/**`
   - `https://tvadomena.cz/**` (pokud budeš používat vlastní doménu)

Po uložení zkus znovu přihlášení na živé stránce.

## 5. Vlastní doména (volitelně)

V projektu na Vercelu: **Settings** → **Domains** → přidej svou doménu a podle návodu nastav DNS (A/CNAME záznamy u poskytovatele domény). V Supabase pak v Redirect URLs a Site URL použij tuto doménu.

## Shrnutí

- Kód na GitHubu → Vercel import → přidat env proměnné → Redeploy.
- V Supabase nastavit **Site URL** a **Redirect URLs** na produkční adresu (Vercel nebo vlastní doména).
- Po každém `git push` na `main` Vercel automaticky nasadí novou verzi.

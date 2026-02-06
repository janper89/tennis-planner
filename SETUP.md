# Kontrolní seznam nastavení

## ✅ Co je hotové

- [x] Next.js projekt s TypeScript a Tailwind CSS
- [x] Supabase klienti (client.ts a server.ts)
- [x] SQL schéma v `supabase/schema.sql`
- [x] Middleware pro autentizaci
- [x] Login stránka s magic link
- [x] Parent dashboard (`/parent`)
- [x] Coach dashboard (`/coach`)
- [x] Manager dashboard (`/manager`)
- [x] Admin funkcionalita s přepínačem rolí
- [x] README s instrukcemi

## 🔧 Co je potřeba nastavit

### 1. Supabase projekt

1. Vytvoř nový projekt na [supabase.com](https://supabase.com)
2. V **SQL Editor** vlož obsah souboru `supabase/schema.sql`
3. Získej API klíče z **Settings** → **API**:
   - Project URL
   - anon/public key

### 2. Environment proměnné

1. Zkopíruj `.env.local.example` jako `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Vyplň hodnoty v `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 3. Admin e-mail

Uprav `lib/config.ts` a přidej svůj e-mail:
```typescript
export const ADMIN_EMAILS = [
  'tvuj-email@example.com', // Nahraď svým e-mailem
];
```

### 4. Supabase Authentication nastavení

V Supabase Dashboard:
- **Authentication** → **URL Configuration**
- **Site URL**: `http://localhost:3000` (pro vývoj) nebo tvá production URL
- **Redirect URLs** – přidej všechny adresy, kam má Supabase přesměrovávat:
  - `http://localhost:3000/login`
  - `http://localhost:3000/password/reset` (nutné pro „Zapomněli jste heslo?“)
  - V produkci také např. `https://tva-domena.cz/password/reset`

Bez `/password/reset` v Redirect URLs Supabase nepošle odkaz na reset hesla nebo bude odkaz neplatný.

### 5. Spuštění

```bash
npm install
npm run dev
```

Aplikace poběží na [http://localhost:3000](http://localhost:3000)

## ⚠️ Důležité poznámky

1. **První přihlášení**: Při prvním přihlášení se automaticky vytvoří záznam v `app_user` s rolí `parent`
2. **Role**: Role se nastavují v databázi v tabulce `app_user`
3. **RLS**: Row Level Security je aktivní - uživatelé vidí pouze data, ke kterým mají přístup
4. **Admin**: Pokud je tvůj e-mail v `ADMIN_EMAILS`, máš automaticky práva manažera + přepínač rolí

## 🐛 Řešení problémů

### Build selhává kvůli env proměnným
- Ujisti se, že máš `.env.local` s správnými hodnotami
- Pro vývoj použij `npm run dev` (build není nutný)

### Chyba při přihlášení
- Zkontroluj `Site URL` v Supabase
- Ověř, že `.env.local` obsahuje správné hodnoty

### Email na reset hesla nepřichází
1. **Redirect URL**: V Supabase → **Authentication** → **URL Configuration** → **Redirect URLs** musí být přesně ta adresa, na které běží aplikace (např. `http://localhost:3000/password/reset` nebo tvá production URL). Bez toho Supabase odkaz v emailu nevygeneruje správně.
2. **Spam**: Zkontroluj složku spam / hromadná pošta.
3. **Výchozí SMTP**: Supabase posílá emaily přes vlastní server (s limity). Pokud emaily stále nedorazí, nastav v Supabase → **Project Settings** → **Auth** → **SMTP** vlastní SMTP (např. Resend, SendGrid, nebo SMTP tvého poskytovatele).

### Odkaz na reset hesla vypršel (otp_expired)
- Odkaz v emailu platí jen **omezenou dobu** (v Supabase většinou 1 hodina) a lze ho použít **jen jednou**. Po kliknutí se zobrazí srozumitelná hláška a formulář na vyžádání nového odkazu.
- Pokud e-mailový klient nebo antivirus odkazy v mailu „proklikává“ před uživatelem, token se spotřebuje a pak už odkaz nefunguje. Řešení: požádat o nový odkaz a použít ho v prohlížeči co nejdřív.
- Platnost lze v Supabase prodloužit: **Authentication** → **Email Templates** (nebo v konfiguraci Auth) – pokud je tam možnost nastavit platnost odkazu (např. „Secure email change link expiry“ nebo podobně).

### RLS chyby
- Zkontroluj, že SQL schéma bylo správně nahráno
- Ověř, že uživatel má správnou roli v `app_user`


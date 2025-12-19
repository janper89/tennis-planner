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
- **Site URL**: `http://localhost:3000/login` (pro vývoj)
- **Redirect URLs**: přidej `http://localhost:3000/login`

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

### RLS chyby
- Zkontroluj, že SQL schéma bylo správně nahráno
- Ověř, že uživatel má správnou roli v `app_user`


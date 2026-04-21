# Nastavení hesla pro bronislav.lebis@seznam.cz

## Problém
Skript `set-user-password.js` vrací **User not found** – uživatel s daným ID neexistuje v projektu, na který ukazuje `.env.local`, nebo ID je z jiného projektu.

## Řešení: Supabase Dashboard (bez skriptu)

1. Otevři **Supabase Dashboard**: https://supabase.com/dashboard  
2. Vyber projekt **fpjwuwfxnaszndrdfghg** (nebo ten, kam nasazuješ aplikaci).
3. V levém menu: **Authentication** → **Users**.
4. Najdi uživatele **bronislav.lebis@seznam.cz** (vyhledávání nebo procházení seznamu).
5. Klikni na řádek uživatele.
6. V detailu uživatele:
   - buď použij **Send password recovery** (pošle e‑mail s odkazem na reset hesla),
   - nebo pokud Dashboard nabízí **Update user** / **Edit** – tam můžeš nastavit nové heslo přímo.
7. Pokud uživatel v seznamu **není**:
   - Klikni **Add user** → **Create new user**,
   - Email: `bronislav.lebis@seznam.cz`,
   - Password: `vyjezdy123`,
   - zaškrtni **Auto Confirm User**,
   - ulož.
8. Ověř v tabulce **app_user** (SQL Editor), že existuje záznam s tímto emailem a rolí `parent`:
   ```sql
   SELECT id, email, role FROM app_user WHERE email = 'bronislav.lebis@seznam.cz';
   ```
   Pokud ne, přidej:
   ```sql
   INSERT INTO app_user (email, role) VALUES ('bronislav.lebis@seznam.cz', 'parent');
   ```

## Ověření projektu

Ujisti se, že kontroluješ **stejný** Supabase projekt jako aplikace:

- Aplikace používá: `NEXT_PUBLIC_SUPABASE_URL` z `.env.local` → `https://fpjwuwfxnaszndrdfghg.supabase.co`
- V Dashboardu musíš být v projektu s touto URL.

Pokud máš více projektů (např. staging/produkce), zkontroluj, který z nich aplikace skutečně používá.

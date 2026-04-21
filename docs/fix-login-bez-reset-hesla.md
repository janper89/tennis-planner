# Přihlášení bez funkčního „Zapomněl jsem heslo“

Když SMTP neposílá resetovací emaily spolehlivě, můžeš uživateli nastavit heslo a přístup přímo v databázi.

## Proč jen UPDATE hesla nestačilo

Přihlášení v aplikaci vyžaduje **tři věci**:

1. **auth.users** – účet s platným heslem, potvrzeným emailem (`email_confirmed_at`), bez blokace (`banned_until` = NULL) a bez starých tokenů (confirmation_token, recovery_token = NULL). Bez toho `signInWithPassword` selže („Nesprávný email nebo heslo“).
2. **auth.identities** – musí existovat záznam pro provider `email` s daným `user_id`. GoTrue při přihlášení kontroluje identity; bez záznamu může přihlášení selhat.
3. **app_user** – řádek se stejným emailem a rolí (`parent` / `coach` / `manager`). Bez toho auth projde, ale aplikace hlásí: *„Uživatel s emailem … nemá přiřazenou roli v databázi.“*

Časté příčiny, proč to po „nastavení hesla přes SQL“ stále nefunguje: chybí záznam v **app_user**, chybí nebo je špatný záznam v **auth.identities**, účet má nastavené **banned_until**, nebo tokeny jsou prázdné řetězce místo NULL.

## Řešení

### Doporučené: Admin API (když SQL pořád dává „Invalid login credentials“)

V projektu je skript **`scripts/set-user-password.js`**, který nastaví heslo přes **Supabase Admin API**. GoTrue pak heslo ukládá ve správném formátu a identity zůstávají v pořádku.

```bash
# z kořene projektu (s .env.local)
node scripts/set-user-password.js
```

Výchozí email: `filip.marsik@tiscali.cz`, heslo: `vyjezdy123`. Jiný uživatel/heslo:

```bash
node scripts/set-user-password.js --email=jan@example.com --password=mojeheslo
```

Skript zároveň doplní záznam v **app_user**, pokud chybí.

### Alternativa: SQL

Skript **`supabase/fix_filip_marsik_login.sql`** (spustit v SQL Editoru):

- Nastaví heslo a potvrdí email v `auth.users`, doplní `auth.identities` a **app_user**.
- Pokud Admin API výše nepomohlo, může pomoct až tento SQL (nebo naopak).

**Jak spustit:** Supabase Dashboard → SQL Editor → vložit obsah souboru → Run.

Po spuštění by se měl uživatel **filip.marsik@tiscali.cz** přihlásit s heslem **vyjezdy123**.

## Obecný postup pro další uživatele

1. V **SQL Editoru** zkopíruj skript a změň na začátku bloku `DO $$`:
   - `v_email` na daný email,
   - `v_password` na dohodnuté heslo.
2. Spusť skript.
3. Uživateli sděl heslo (ideálně jiným kanálem než e‑mailem, pokud SMTP nefunguje).

Stejný princip lze použít pro jakýkoliv email – stačí upravit `v_email` a `v_password` v souboru a znovu spustit.

# Postup: Nastavení Resend + Supabase pro reset hesla (janperutka.com)

Tenisová aplikace bude posílat e-maily (reset hesla) přes Resend z domény **janperutka.com**.  
Pokud bude aplikace na subdoméně (např. `tenis.janperutka.com`), v krocích nahraď `janperutka.com` touto subdoménou tam, kde je to potřeba (Site URL, Redirect URL).

---

## Krok 1: Resend – ověření domény (janperutka.com)

1. Přihlas se na **https://resend.com** → **Domains** (nebo https://resend.com/domains).
2. Klikni **Add Domain**.
3. Zadej doménu:
   - Pro odesílání z `noreply@janperutka.com` zadej: **`janperutka.com`**  
   - (Nebo subdoménu, např. `mail.janperutka.com` – pak bude odesílatel např. `noreply@mail.janperutka.com`.)
4. Resend ti ukáže **DNS záznamy**, které musíš přidat u svého poskytovatele domény (kde máš janperutka.com):
   - **SPF** – jeden TXT záznam
   - **DKIM** – jeden nebo více TXT záznamů
5. U poskytovatele domény (Cloudflare, O2, Forpsi, atd.):
   - Přidej přesně ty záznamy (typ TXT, jméno a hodnotu z Resend).
   - U DKIM dej pozor na **jméno** záznamu (např. něco jako `resend._domainkey`).
6. V Resend klikni **Verify DNS Records** (nebo „Zkontrolovat“).
7. Počkej pár minut až hodinu; stav domény by se měl změnit na **Verified**.  
   Pokud ne, použij v Resend nápovědu „Domain not verifying?“ nebo zkontroluj, že záznamy jsou bez překlepů a že DNS už bylo propagované.

**Výsledek:** Můžeš odesílat e-maily z adres typu `noreply@janperutka.com` (nebo z subdomény, kterou jsi zadal).

---

## Krok 2: Resend – API klíč

1. V Resend: **API Keys** (v menu / Settings).
2. **Create API Key**.
3. Název např. „Supabase SMTP“.
4. Oprávnění: stačí **Sending access** (odesílání).
5. Zkopíruj klíč (začíná typicky `re_...`).  
   **Ulož si ho – po zavření stránky ho už znovu neuvidíš.**

**Výsledek:** Máš API klíč, který použiješ v Supabase jako heslo pro SMTP.

---

## Krok 3: Supabase – URL konfigurace

1. Otevři **Supabase Dashboard** → svůj projekt (tenisová app).
2. Vlevo: **Authentication** → **URL Configuration**.
3. Nastav:
   - **Site URL:**  
     `https://janperutka.com`  
     (nebo přesná adresa, na které běží tenisová aplikace, např. `https://tenis.janperutka.com`).
   - **Redirect URLs:** klikni **Add URL** a přidej:  
     `https://janperutka.com/password/reset`  
     (nebo `https://tenis.janperutka.com/password/reset`, pokud je app na subdoméně).
4. Ulož (Save).

**Výsledek:** Supabase bude posílat odkazy na reset hesla na správnou adresu a redirect po kliknutí bude povolený.

---

## Krok 4: Supabase – vlastní SMTP (Resend)

1. V Supabase: **Project Settings** (ikona ozubeného kolečka) → **Auth**.
2. Najdi sekci **SMTP Settings** (nebo „Custom SMTP“).
3. Zapni **Enable Custom SMTP**.
4. Vyplň podle Resend dokumentace:
   - **Sender email:** `noreply@janperutka.com` (nebo `noreply@mail.janperutka.com`, pokud používáš subdoménu).
   - **Sender name:** např. `Tenisový klub` nebo `Jan Perutka`.
   - **Host:** `smtp.resend.com`
   - **Port:** `465`
   - **Username:** `resend`
   - **Password:** tvůj **Resend API klíč** (z Kroku 2).
5. Ulož.

**Výsledek:** Reset hesla a další auth e-maily půjdou přes Resend z tvé domény, bez limitu 2 e-maily/hodinu.

---

## Krok 5: Aplikace – .env.local a produkce

1. **Lokálně** v projektu v souboru **`.env.local`**:
   - Nastav (nebo uprav):  
     `NEXT_PUBLIC_SITE_URL=https://janperutka.com`  
     (nebo `https://tenis.janperutka.com`, pokud je to adresa appky).
2. **Produkce** (Vercel / Netlify / jiný hosting):
   - Do proměnných prostředí (Environment Variables) přidej:  
     `NEXT_PUBLIC_SITE_URL` = `https://janperutka.com`  
     (nebo tvá skutečná produkční URL).
   - U Vercelu: Project → Settings → Environment Variables. Nastav pro Production (a případně Preview, pokud chceš).

**Výsledek:** Odkaz v e-mailu pro reset hesla bude vždy vést na tvou produkční doménu.

---

## Kontrola

- Požádej o reset hesla na produkční stránce (na janperutka.com).
- E-mail by měl přijít z `noreply@janperutka.com` (nebo z tvé subdomény).
- Kliknutí na odkaz by mělo otevřít `/password/reset` na tvé doméně a po nastavení nového hesla by mělo přihlášení fungovat.

Pokud e-mail nepřijde: zkontroluj Resend → Logs (poslané e-maily) a Supabase → Auth → Logs (jestli byl požadavek na reset odeslán).

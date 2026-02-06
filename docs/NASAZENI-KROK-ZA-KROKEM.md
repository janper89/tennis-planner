# Nasazení na Vercel – krok za krokem (bod A)

---

## Rychlá aktualizace (projekt už na Vercelu běží)

Když máš webovky už nasazené a chceš na ně dostat jen nové změny z localhostu:

1. V terminálu v adresáři projektu:
   ```bash
   cd "/Users/janperutka/Desktop/AI mozek/Projekty/tennis-club"
   git add .
   git status
   git commit -m "Aktualizace: reset hesla, přihlášení, deploy doc"
   git push origin main
   ```
   (Pokud používáš větev `master`, napiš `git push origin master`.)

2. Vercel při pushi na `main` sám spustí nový deploy. Za minutu až dvě bude na webu nová verze. Stav můžeš zkontrolovat na [vercel.com](https://vercel.com) → tvůj projekt → **Deployments**.

---

## První nasazení (krok za krokem)

Postupuj podle čísel. Každý krok končí tím, že máš hotovo to, co je u něj napsané.

---

## Krok 1: Repozitář na GitHubu

1. Otevři v prohlížeči [github.com](https://github.com) a přihlas se.
2. Klikni na **„New“** (nebo **„+“** → **New repository**).
3. **Repository name:** napiš `tennis-club` (nebo jiný název, který chceš).
4. Nech **Public**, ostatní nech prázdné. Klikni **Create repository**.
5. GitHub ti ukáže stránku s příkazy. **Nepoužívej „…or push an existing repository“** – místo toho v terminálu u sebe spusť (nahraď `TVE_USERNAME` svým GitHub uživatelským jménem):

   ```bash
   cd "/Users/janperutka/Desktop/AI mozek/Projekty/tennis-club"
   git remote -v
   ```
   - Pokud už máš `origin` a ukazuje na správný repozitář, pokračuj na příkaz níže.
   - Pokud `origin` nemáš nebo ukazuje jinam, přidej ho:
     ```bash
     git remote add origin https://github.com/TVE_USERNAME/tennis-club.git
     ```
     (Jednou můžeš použít i SSH adresu, pokud ji máš nastavenou.)

6. Nahraj kód na GitHub:

   ```bash
   git add .
   git status
   git commit -m "Připraveno k nasazení"
   git push -u origin main
   ```
   - Pokud používáš větev `master`, napiš: `git push -u origin master`.

**Hotovo v kroku 1:** Na GitHubu v repozitáři `tennis-club` vidíš všechny soubory projektu.

---

## Krok 2: Vercel účet a import projektu

1. Otevři [vercel.com](https://vercel.com).
2. Klikni **Sign Up** nebo **Log In**. Ideálně zvol **Continue with GitHub** – propojíš účet a uvidíš repozitáře.
3. Po přihlášení klikni **Add New…** (nebo **New Project**).
4. V seznamu repozitářů najdi **tennis-club** a u něj klikni **Import** (nebo **Import Git Repository**).
5. Na stránce konfigurace projektu:
   - **Framework Preset:** mělo by být **Next.js** (Vercel to většinou pozná).
   - **Root Directory:** nech **„.“** (tečka).
   - **Build and Output Settings:** nic neměň.
6. **Environment Variables** zatím nevyplňuj – přidáš je v kroku 4.
7. Klikni **Deploy**.

Po chvíli build buď doběhne (může být žlutá/červená chyba kvůli chybějícím env – to je v pořádku), nebo uvidíš odkaz na stránku projektu.

**Hotovo v kroku 2:** Máš na Vercelu vytvořený projekt napojený na GitHub. Máš adresu typu `https://tennis-club-xxxx.vercel.app` (tu si zapiš pro krok 5).

---

## Krok 3: Zjistit adresu projektu na Vercelu

1. Na Vercelu otevři svůj projekt **tennis-club**.
2. Nahoře nebo v záložce **Deployments** uvidíš adresu (doménu), např. `tennis-club-abc123.vercel.app`.
3. Zapiš si ji včetně `https://`, např. `https://tennis-club-abc123.vercel.app` – budeš ji potřebovat v kroku 5.

**Hotovo v kroku 3:** Víš, jaká je tvoje produkční URL.

---

## Krok 4: Environment proměnné na Vercelu

1. V projektu na Vercelu vlevo klikni **Settings**.
2. V menu vlevo zvol **Environment Variables**.
3. Přidej dvě proměnné (hodnoty zkopíruj ze svého `.env.local` v projektu):

   **První proměnná:**
   - **Name:** `NEXT_PUBLIC_SUPABASE_URL`
   - **Value:** `https://tvé-projekt-id.supabase.co` (tvůj Supabase Project URL)
   - **Environment:** zaškrtni **Production** i **Preview**.  
   Klikni **Save**.

   **Druhá proměnná:**
   - **Name:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Value:** tvůj Supabase anon (public) key (dlouhý řetězec)
   - **Environment:** zaškrtni **Production** i **Preview**.  
   Klikni **Save**.

4. Spusť nový deploy s těmito proměnnými:
   - Klikni **Deployments** (vlevo).
   - U posledního deploymentu klikni na **⋮** (tři tečky).
   - Zvol **Redeploy**.
   - Potvrď **Redeploy** (nech zaškrtnuté „Use existing Build Cache“ nebo podle výchozího).

**Hotovo v kroku 4:** Na Vercelu máš nastavené env proměnné a proběhl nový deploy. Po chvíli by měl být deployment zelený (Success).

---

## Krok 5: Supabase – povolit produkční adresu

Aby na živé stránce fungovalo přihlášení a reset hesla, Supabase musí znát tvoji Vercel adresu.

1. Otevři [Supabase Dashboard](https://supabase.com/dashboard) a vyber svůj projekt.
2. Vlevo klikni **Authentication**, pak **URL Configuration**.
3. **Site URL:**  
   Změň na svoji Vercel adresu z kroku 3, např. `https://tennis-club-abc123.vercel.app` (bez lomítka na konci).
4. **Redirect URLs:**  
   V seznamu přidej (jednu řádek = jedna URL):
   - `https://tennis-club-abc123.vercel.app/**`  
     (nahraď `tennis-club-abc123.vercel.app` svou skutečnou doménou)
   - `https://tennis-club-abc123.vercel.app/password/reset`
5. Klikni **Save**.

**Hotovo v kroku 5:** Supabase teď posílá uživatele po přihlášení / resetu hesla na tvou Vercel aplikaci.

---

## Krok 6: Ověření

1. Otevři v prohlížeči svoji Vercel adresu (např. `https://tennis-club-abc123.vercel.app`).
2. Měla by se načíst přihlašovací stránka.
3. Zkus se přihlásit svým emailem a heslem.
4. Zkus „Zapomněli jste heslo?“ – měl by tě to poslat na stránku pro reset a po zadání emailu by měl přijít mail (zkontroluj i spam).

**Hotovo v kroku 6:** Aplikace běží na Vercelu a přihlášení (a reset hesla) funguje.

---

## Co dál

- **Automatické nasazení:** Při každém `git push` na větev `main` (nebo výchozí větev, kterou máš na Vercelu nastavenou) Vercel sám spustí nový deploy.
- **Vlastní doména:** V projektu na Vercelu: **Settings** → **Domains** → přidej doménu a u poskytovatele DNS nastav záznamy podle návodu. V Supabase pak v **Site URL** a **Redirect URLs** přidej tuto doménu.

Případné problémy (build failed, přihlášení nefunguje) jsou popsány v `docs/DEPLOY.md` v sekcích 3 a 4.

# Kontrola flow e‑mailu pro reset hesla

## 1. Kde se volá `resetPasswordForEmail`

**Soubor:** `app/(auth)/password/reset/page.tsx`

```tsx
const handleRequestReset = async (e: React.FormEvent) => {
  e.preventDefault();
  setError(null);
  setLoading(true);

  try {
    const redirectUrl = `${window.location.origin}/password/reset`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      {
        redirectTo: redirectUrl,
      }
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  } catch (err) {
    console.error('Password reset error:', err);
    setError('Došlo k chybě při odesílání emailu');
    setLoading(false);
  }
};
```

- **Redirect URL:** Sestavuje se jako `window.location.origin + '/password/reset'`, takže cesta je správně (`/password/reset`).
- **Chyby:** Chyby z API se neignorují – při `resetError` se zobrazí `resetError.message`, v catch bloku obecná hláška. Pozor: Supabase často vrací **úspěch** i když e‑mail reálně neodešle (např. rate limit nebo vypnutý e‑mail), aby se neprozrazovalo, jestli e‑mail existuje – takže uživatel může vidět „e‑mail odeslán“, i když nepřišel.

---

## 2. Nastavení redirect URL

- **V kódu:** `redirectTo` je `https://<aktuální-origin>/password/reset`. Cesta je v pořádku.
- **V Supabase:** Přesná redirect URL musí být v projektu v povolených adresách:
  - **Dashboard → Authentication → URL Configuration → Redirect URLs**
  - Přidej např. `https://tvoje-domena.cz/password/reset` a pro lokální vývoj `http://localhost:3000/password/reset` (nebo wildcard `http://localhost:3000/**`).
- **Site URL:** Ve stejném URL Configuration je „Site URL“ výchozí adresa, když v kódu neposíláš `redirectTo`. Když je špatně (třeba pořád `http://localhost:3000` v produkci), můžou se lámat jiné auth e‑maily. Tvůj kód `redirectTo` posílá, takže jde spíš o doplněk, ale je dobré to mít správně.

---

## 3. Supabase klient a proměnné prostředí

- **Klient:** `lib/supabase/client.ts` používá:
  - `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Žádné `NEXT_PUBLIC_SITE_URL` / `APP_URL`:** Aplikace nepoužívá pevnou URL stránky. Redirect pro reset je vždy `window.location.origin + '/password/reset'`.

Shrnutí:

- **Správně:** Používá se jeden Supabase projekt (veřejná URL + anon klíč).
- **Riziko:** Když uživatel otevře aplikaci z jiné adresy (http vs https, www vs bez www, preview URL), redirect URL poslaná do Supabase bude odpovídat té adrese. Když ta adresa není v Redirect URLs, Supabase ji může odmítnout nebo odkaz v e‑mailu povede někam špatně. Použití jedné kanonické `NEXT_PUBLIC_SITE_URL` pro `redirectTo` v produkci by chování sjednotilo.

---

## 4. Ošetření chyb u volání resetu

- **Nejsou tiše potlačeny:** Při `resetError` se nastaví `setError(resetError.message)` a kód skončí. Při výjimce se nastaví obecná chybová hláška a chyba se loguje do konzole.
- **Omezení:** Když Supabase nevrátí chybu, ale e‑mail neodešle (rate limit, vypnuté vestavěné SMTP), uživatel stejně uvidí „e‑mail odeslán“. Takže „e‑mail nepřišel“ může nastat i při zobrazeném úspěchu. Jistota je jen z logů Supabase / nastavení SMTP a případně fallback (vlastní SMTP nebo nastavení hesla přes admin, jak máš v docs).

---

## 5. Stránka `/password/reset` – zpracování tokenu

- **Hash (implicitní flow):** Stránka čte `window.location.hash` a parsuje ho přes `URLSearchParams`:
  - rozpozná `type=recovery` a nastaví krok na `'reset'`,
  - rozpozná `error_code=otp_expired` nebo `error_description` obsahující „expired“ (nebo `code=403`) a zobrazí „odkaz vypršel“ a vrátí na formulář pro vyžádání resetu.
- **Auth stav:** Používá se `supabase.auth.onAuthStateChange` pro `PASSWORD_RECOVERY` a `SIGNED_IN`, aby se nastavil krok na `'reset'`. Když Supabase přesměruje na `/password/reset#access_token=...&type=recovery`, klient hash zpracuje, naváže session a vyvolá tyto události – formulář „nastavit nové heslo“ se zobrazí správně.
- **Query parametry:** Kontroluje se `searchParams.get('type') === 'recovery'` (pro `?type=recovery`). **Není** ošetřen parametr `?code=...` ani volání `exchangeCodeForSession`. Takže:
  - **Implicitní flow (hash):** je ošetřené správně,
  - **PKCE flow (redirect s `?code=...`):** Pokud projekt používá pro recovery PKCE a redirect jde na `/password/reset?code=...`, tato stránka kód nevymění, session se nenastaví a uživatel může při odeslání nového hesla vidět „Session vypršela“. Při PKCE by bylo potřeba na načtení stránky zkontrolovat `code` v URL a zavolat `exchangeCodeForSession(code)` a pak nastavit krok na `'reset'`.

---

## 6. Pevné URL a chybějící `NEXT_PUBLIC_SITE_URL` / `APP_URL`

- **Žádná pevná produkční URL:** Redirect je vždy `window.location.origin + '/password/reset'`.
- **Žádné `NEXT_PUBLIC_SITE_URL` ani `APP_URL`:** V repozitáři se nepoužívají. V produkci tedy redirect URL odpovídá tomu, z jaké adresy uživatel aplikaci otevřel. Když použije jinou adresu (preview, alias, překlep), odkaz v e‑mailu může vést na URL, která v Supabase není v povolených. V dokumentaci Supabase doporučují nastavit v produkci `NEXT_PUBLIC_SITE_URL` a použít ji pro `redirectTo`, aby odkaz v e‑mailu byl vždy na kanonickou adresu.

---

## Shrnutí zjištění

| Oblast | Zjištění |
|--------|----------|
| **resetPasswordForEmail** | Volá se v `app/(auth)/password/reset/page.tsx` s `redirectTo: window.location.origin + '/password/reset'`. Cesta je správně. |
| **Redirect URL** | Cesta je správně. Musí být v Supabase v Redirect URLs. V aplikaci není env pro kanonickou URL. |
| **Supabase klient** | Používá `NEXT_PUBLIC_SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Žádné SITE_URL. |
| **Chyby** | Chyby z API se zobrazují, neignorují se. Úspěch se může zobrazit i když e‑mail neodešel (chování Supabase). |
| **Token na /password/reset** | Hash fragment (`#access_token=...&type=recovery`) se zpracovává přes parsování hashe a `onAuthStateChange`. Není ošetřen `?code=...` (PKCE). |
| **Kanonická URL** | Chybí `NEXT_PUBLIC_SITE_URL`; redirect závisí na `window.location.origin`. |

---

## Co nejspíš způsobuje, že e‑maily nepřicházejí nebo že flow selhává

1. **Výchozí e‑mail Supabase (vestavěné SMTP) a rate limit**  
   Výchozí odesílání e‑mailů má **velmi nízký limit** (v docs cca **2 e‑maily za hodinu** u zkušebního provozu a „best-effort“ doručení). Na free tieru s výchozím providerem může při více požadavcích na reset většina e‑mailů vůbec neodejít, přitom API vrací úspěch. To je **velmi pravděpodobná** příčina „e‑mail nepřišel“.

2. **Redirect URL není v povolených**  
   Když `https://<tvoje-domena>/password/reset` (nebo přesná adresa, kterou používáš) není v **Authentication → URL Configuration → Redirect URLs**, Supabase může odkaz neposlat nebo použít špatnou/blokovanou URL. Spíš se pak láme odkaz než že by e‑mail vůbec nešel, ale může to flow pokazit.

3. **Špatná nebo chybějící Site URL**  
   Když je v URL Configuration „Site URL“ pořád např. `http://localhost:3000` v produkci, některé auth e‑maily se můžou skládat ze špatné základní adresy. Tvůj kód posílá `redirectTo` explicitně, takže jde o vedlejší věc, ale stojí za to to mít nastavené správně.

4. **PKCE a `?code=`**  
   Když projekt používá PKCE a recovery redirect používá `?code=...` místo hashe, současná stránka `/password/reset` kód nevymění, session se nenastaví a flow selže po kliknutí na odkaz.

---

## Doporučené úpravy

1. **Počítej s tím, že výchozí e‑mail je omezený a nespolehlivý**  
   - „E‑mail nepřišel“ ber jako očekávatelné při vestavěném SMTP.  
   - V produkci **nastav vlastní SMTP** (např. Resend, SendGrid, AWS SES) v Supabase (**Project Settings → Auth → SMTP**), aby doručení a limity byly pod kontrolou.

2. **Zkontroluj URL konfiguraci v Supabase**  
   - V **Authentication → URL Configuration**:  
     - Přidej přesnou produkční reset URL, např. `https://tvoje-domena.cz/password/reset`.  
     - Nastav **Site URL** na produkční origin (např. `https://tvoje-domena.cz`).  
     - Pro lokální vývoj nech v Redirect URLs `http://localhost:3000/password/reset` nebo `http://localhost:3000/**`.

3. **V produkci používej kanonickou URL**  
   - Přidej `NEXT_PUBLIC_SITE_URL` (např. `https://tvoje-domena.cz`) a při sestavování `redirectTo` v produkci ji použij, aby odkaz v e‑mailu byl vždy stejný a v povolených:
     - Příklad: `redirectTo: process.env.NEXT_PUBLIC_SITE_URL ? \`${process.env.NEXT_PUBLIC_SITE_URL}/password/reset\` : \`${window.location.origin}/password/reset\``
   - Omezí to problémy s jiným originem (preview, http vs https atd.).

4. **Volitelně: ošetři PKCE `?code=` na `/password/reset`**  
   - Pokud používáš nebo plánuješ PKCE: při načtení stránky, když je v URL `searchParams.get('code')`, zavolej `supabase.auth.exchangeCodeForSession(code)` a pak nastav krok na `'reset'`. Flow pak bude fungovat i když Supabase pošle v redirectu `code` v query místo tokenů v hashi.

5. **Texty pro uživatele**  
   - Zachovej současnou hlášku o úspěchu a doplň krátkou poznámku, že doručení může chvíli trvat a že mají zkontrolovat spam; když e‑mail nepřijde, ať zkusí požádat znovu později nebo kontaktují podporu (a můžeš dál používat admin flow pro ruční nastavení hesla).

---

## Výchozí e‑mail Supabase (free tier)

Vestavěné odesílání e‑mailů u Supabase je určené hlavně na vyzkoušení. V dokumentaci uvádějí:

- **Rate limit:** Cca **2 e‑maily za hodinu** u výchozího vestavěného SMTP (přesný limit se může lišit).
- **Doručení:** „Best-effort“ – pro produkci negarantované.
- **Rozsah:** Limit platí pro **všechny** auth e‑maily (registrace, reset hesla atd.) dohromady.

Takže pokud projekt používá tento výchozí provider a nemáš vlastní SMTP, narážení na limit nebo nespolehlivé doručení je velmi pravděpodobný důvod, proč uživatelé resetovací e‑maily nedostávají. Pro produkci je doporučené nastavit vlastní SMTP.

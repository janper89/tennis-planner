# Password reset email flow – review

## 1. Where `resetPasswordForEmail` is called

**File:** `app/(auth)/password/reset/page.tsx`

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

- **Redirect URL:** Built as `window.location.origin + '/password/reset'`, so the path is correct (`/password/reset`).
- **Error handling:** API errors are not swallowed: `resetError` is shown via `setError(resetError.message)`, and the catch block shows a generic message. Note: Supabase often returns **success** even when the email is not actually sent (e.g. rate limit or disabled email), to avoid email enumeration, so the UI can show “email sent” while no email arrives.

---

## 2. Redirect URL configuration

- **In code:** `redirectTo` is set to `https://<current-origin>/password/reset`. So the path is correct.
- **In Supabase:** The **exact** redirect URL must be allowlisted in the project:
  - **Dashboard → Authentication → URL Configuration → Redirect URLs**
  - Add e.g. `https://your-production-domain.com/password/reset` and, for local dev, `http://localhost:3000/password/reset` (or use wildcards like `http://localhost:3000/**`).
- **Site URL:** In the same URL Configuration, “Site URL” is the default when no `redirectTo` is passed. If it’s wrong (e.g. still `http://localhost:3000` in production), some flows can break. It does not override an explicit `redirectTo`, but it’s still important for other auth emails.

---

## 3. Supabase client and environment variables

- **Client:** `lib/supabase/client.ts` uses:
  - `process.env.NEXT_PUBLIC_SUPABASE_URL`
  - `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **No `NEXT_PUBLIC_SITE_URL` / `APP_URL`:** The app does not use a fixed site URL. The reset redirect is always `window.location.origin + '/password/reset'`.

So:

- **Correct:** Same Supabase project is used (public URL + anon key).
- **Risk:** If the user opens the app via a different host (e.g. `http://` vs `https://`, or `www` vs non-`www`, or a preview URL), the redirect URL we send to Supabase will match that host. If that URL is not in the Redirect URLs allowlist, Supabase may reject the redirect or the link in the email may point somewhere invalid. Using a single canonical `NEXT_PUBLIC_SITE_URL` for `redirectTo` in production would make behaviour predictable.

---

## 4. Error handling around the reset call

- **Not silently swallowed:** On `resetError`, the code sets `setError(resetError.message)` and returns. On exception, it sets a generic error message and logs to console.
- **Limitation:** If Supabase returns **no error** but doesn’t send the email (e.g. rate limit, or inbuilt SMTP disabled), the user still sees “email sent”. So “no email received” can happen even when the UI says success. The only way to be sure is to check Supabase logs / SMTP config and, if needed, add a fallback (e.g. custom SMTP and/or admin-set password as in your docs).

---

## 5. `/password/reset` page – token handling

- **Hash fragment (implicit flow):** The page reads `window.location.hash` and parses it with `URLSearchParams`:
  - Detects `type=recovery` and sets step to `'reset'`.
  - Detects `error_code=otp_expired` or `error_description` containing “expired” (or `code=403`) and shows “link expired” and switches back to the request form.
- **Auth state:** It uses `supabase.auth.onAuthStateChange` for `PASSWORD_RECOVERY` and `SIGNED_IN` to set the step to `'reset'`. When Supabase redirects to `/password/reset#access_token=...&type=recovery`, the Supabase client parses the hash, establishes the session, and fires these events, so the “set new password” form is shown correctly.
- **Query params:** It checks `searchParams.get('type') === 'recovery'` (for `?type=recovery`). It does **not** read `?code=...` or call `exchangeCodeForSession`. So:
  - **Implicit flow (hash):** Handled correctly.
  - **PKCE flow (redirect with `?code=...`):** If your Supabase project uses PKCE for recovery and redirects to `/password/reset?code=...`, this page does not exchange the code. The session would not be set and the user could see “Session vypršela” when submitting the new password. If you use PKCE, you’d need to detect `code` in the URL and call `exchangeCodeForSession(code)` (and then set step to `'reset'`).

---

## 6. Hardcoded URLs and missing `NEXT_PUBLIC_SITE_URL` / `APP_URL`

- **No hardcoded production URL:** Redirect is always `window.location.origin + '/password/reset'`.
- **No `NEXT_PUBLIC_SITE_URL` or `APP_URL`:** Nothing in the codebase uses these. So:
  - In production, the redirect URL is whatever origin the user has in the browser (e.g. `https://yourdomain.com`). If they use a different URL (preview, alias, typo), the link in the email might point to a URL not allowlisted in Supabase.
  - Supabase’s own docs recommend setting `NEXT_PUBLIC_SITE_URL` (or similar) in production and using it for `redirectTo` so that the link in the email is always the canonical site URL.

---

## Summary of findings

| Area | Finding |
|------|--------|
| **resetPasswordForEmail** | Called in `app/(auth)/password/reset/page.tsx` with `redirectTo: window.location.origin + '/password/reset'`. Path is correct. |
| **Redirect URL** | Path is correct. Must be allowlisted in Supabase (Redirect URLs). No app-level env for canonical URL. |
| **Supabase client** | Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. No SITE_URL. |
| **Errors** | API errors are shown; not swallowed. Success can still be shown when email isn’t sent (Supabase behaviour). |
| **Token on /password/reset** | Hash fragment (`#access_token=...&type=recovery`) is handled via hash parsing + `onAuthStateChange`. No handling for `?code=...` (PKCE). |
| **Canonical URL** | No `NEXT_PUBLIC_SITE_URL`; redirect depends on `window.location.origin`. |

---

## What is likely causing emails not to arrive or the flow to break

1. **Default Supabase email (inbuilt SMTP) and rate limit**  
   Supabase’s default email has a **very low rate limit** (docs mention about **2 emails per hour** for the try-out service, and “best-effort” delivery). If you’re on the free tier and using the default provider, several reset requests in a short time can mean most emails are never sent, while the API still returns success. This is a **very likely** cause of “no email received”.

2. **Redirect URL not allowlisted**  
   If `https://<your-domain>/password/reset` (or the exact origin you use) is not in **Authentication → URL Configuration → Redirect URLs**, Supabase may not send the link or may use a wrong/blocked URL. Less likely to prevent the email entirely, but can break the link.

3. **Wrong or missing Site URL**  
   If “Site URL” in URL Configuration is still `http://localhost:3000` in production, some auth emails might be built with the wrong base. Your code does pass `redirectTo` explicitly, so this is secondary but worth correcting.

4. **PKCE and `?code=`**  
   If the project uses PKCE for auth and the recovery redirect uses `?code=...` instead of a hash, the current `/password/reset` page does not exchange the code, so the session is never set and the flow breaks after the user clicks the link.

---

## Recommended changes

1. **Assume default email is limited and unreliable**  
   - Treat “no email received” as expected when using inbuilt SMTP.  
   - For production: **configure custom SMTP** (e.g. Resend, SendGrid, AWS SES) in Supabase (**Project Settings → Auth → SMTP**) so delivery and rate limits are under your control.

2. **Verify Supabase URL configuration**  
   - In **Authentication → URL Configuration**:  
     - Add the exact production reset URL, e.g. `https://yourdomain.com/password/reset`.  
     - Set **Site URL** to your production origin (e.g. `https://yourdomain.com`).  
     - For local dev, keep `http://localhost:3000/password/reset` or `http://localhost:3000/**` in Redirect URLs.

3. **Use a canonical URL in production**  
   - Add `NEXT_PUBLIC_SITE_URL` (e.g. `https://yourdomain.com`) and use it when building `redirectTo` in production so the link in the email is always the same and allowlisted:
     - Example: `redirectTo: process.env.NEXT_PUBLIC_SITE_URL ? `${process.env.NEXT_PUBLIC_SITE_URL}/password/reset` : `${window.location.origin}/password/reset``
   - Reduces risk of wrong origin (preview URLs, http vs https, etc.).

4. **Optional: Handle PKCE `?code=` on `/password/reset`**  
   - If you use or plan to use PKCE: on load, if `searchParams.get('code')` is present, call `supabase.auth.exchangeCodeForSession(code)` and then set step to `'reset'`. This keeps the flow working if Supabase sends a code in the query string instead of tokens in the hash.

5. **User messaging**  
   - Keep the current success message but add a short note that delivery can take a few minutes and to check spam; if they don’t receive it, they can try again later or contact support (and you can use the existing admin flow to set a password manually when needed).

---

## Supabase default email provider (free tier)

Supabase’s built-in email for auth is intended for trying out the product. The docs state:

- **Rate limit:** About **2 emails per hour** for the default inbuilt SMTP (exact limit can vary).
- **Delivery:** “Best-effort” – not guaranteed for production.
- **Scope:** The limit applies to **all** auth emails (signup, reset, etc.) together.

So if the project is using this default provider and no custom SMTP, hitting the limit or unreliable delivery is very likely why users do not receive password reset emails. Configuring custom SMTP is the recommended fix for production.

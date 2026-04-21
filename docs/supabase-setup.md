# Supabase configuration required for production

Pro tento projekt se používá doména **janperutka.com**.  
Postup krok za krokem je v [nastaveni-resend-a-supabase-kroky.md](./nastaveni-resend-a-supabase-kroky.md).

## Authentication → URL Configuration
- **Site URL:** https://janperutka.com (nebo subdoména, kde běží app)
- **Redirect URLs:** přidej https://janperutka.com/password/reset

## Project Settings → Auth → SMTP
Vlastní SMTP přes Resend.com:
- Host: smtp.resend.com
- Port: 465
- Username: resend
- Password: [tvůj Resend API klíč]
- Sender email: noreply@janperutka.com

## Proč je to potřeba
Výchozí e-mail Supabase má limit ~2 e-maily za hodinu a pro produkci není spolehlivý. Vlastní SMTP (Resend) zajistí doručení bez tohoto limitu.

/**
 * One-off: change a user's email in Supabase Auth and in app_user.
 *
 * Usage:
 *   node scripts/change-user-email.js
 *
 * Env (in .env.local or shell):
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *
 * Edit OLD_EMAIL and NEW_EMAIL below if you need to change a different user.
 */

const fs = require('fs');
const path = require('path');

const OLD_EMAIL = 'pavel.dufek@storaenso.com';
const NEW_EMAIL = 'lock.dufek@seznam.cz';

const envPath = path.resolve(__dirname, '..', '.env.local');
try {
  require('dotenv').config({ path: envPath });
} catch (_) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const t = line.trim();
      if (t && !t.startsWith('#') && t.includes('=')) {
        const i = t.indexOf('=');
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
      }
    });
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (use .env.local or export)');
  process.exit(1);
}

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function main() {
  // 1) Find auth user by email (listUsers and find)
  let authUser = null;
  let page = 1;
  const perPage = 100;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error('Auth listUsers error:', error.message);
      process.exit(1);
    }
    authUser = data.users.find((u) => u.email && u.email.toLowerCase() === OLD_EMAIL.toLowerCase());
    if (authUser || data.users.length < perPage) break;
    page++;
  }

  if (!authUser) {
    console.error('No auth user found with email:', OLD_EMAIL);
    process.exit(1);
  }

  console.log('Found auth user:', authUser.id, authUser.email);

  // 2) Update auth email
  const { data: updateAuth, error: authError } = await supabase.auth.admin.updateUserById(authUser.id, {
    email: NEW_EMAIL,
  });

  if (authError) {
    console.error('Auth updateUserById error:', authError.message);
    process.exit(1);
  }
  console.log('Auth email updated to:', updateAuth.user?.email || NEW_EMAIL);

  // 3) Update app_user
  const { data: appUpdate, error: appError } = await supabase
    .from('app_user')
    .update({ email: NEW_EMAIL })
    .eq('email', OLD_EMAIL)
    .select('id, email, role');

  if (appError) {
    console.error('app_user update error:', appError.message);
    process.exit(1);
  }

  if (!appUpdate || appUpdate.length === 0) {
    console.warn('No app_user row found with email', OLD_EMAIL, '- only Auth was updated.');
  } else {
    console.log('app_user updated:', appUpdate[0]);
  }

  console.log('Done. User can now sign in with', NEW_EMAIL);
}

main();

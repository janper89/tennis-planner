import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ROLE_REDIRECTS, type UserRole } from '@/lib/config';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const supabase = await createClient();

    // Sign in with email and password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        { error: authError.message === 'Invalid login credentials' ? 'Nesprávný email nebo heslo' : authError.message },
        { status: 401 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: 'Přihlášení se nezdařilo' },
        { status: 401 }
      );
    }

    // Get user role from app_user table using server-side client
    const { data: appUsers, error: userError } = await supabase
      .from('app_user')
      .select('role')
      .eq('email', authData.user.email!);

    if (userError) {
      console.error('Error fetching user role:', userError);
      return NextResponse.json(
        { error: `Chyba při načítání role: ${userError.message}` },
        { status: 500 }
      );
    }

    if (!appUsers || appUsers.length === 0) {
      return NextResponse.json(
        { error: `Uživatel s emailem ${authData.user.email} nemá přiřazenou roli v databázi.` },
        { status: 403 }
      );
    }

    if (appUsers.length > 1) {
      console.error('Multiple users found with same email:', appUsers);
      return NextResponse.json(
        { error: 'V databázi je více záznamů se stejným emailem.' },
        { status: 500 }
      );
    }

    const role = appUsers[0].role as UserRole;
    const redirectPath = ROLE_REDIRECTS[role] || '/';

    return NextResponse.json({ success: true, redirectPath });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Došlo k chybě při přihlášení' },
      { status: 500 }
    );
  }
}


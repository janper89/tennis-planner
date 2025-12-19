import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ROLE_REDIRECTS, type UserRole } from '@/lib/config';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') || '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Get user role from app_user table
      const { data: appUser } = await supabase
        .from('app_user')
        .select('role')
        .eq('email', data.user.email!)
        .single();

      if (appUser?.role) {
        const role = appUser.role as UserRole;
        const redirectPath = ROLE_REDIRECTS[role] || next;
        return NextResponse.redirect(new URL(redirectPath, url.origin));
      }

      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  // If there's an error or no code, redirect to login
  return NextResponse.redirect(new URL('/login', url.origin));
}

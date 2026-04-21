'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import TripsSection, { type TripsMode } from '@/components/TripsSection';
import type { Database } from '@/types/database';

type Player = Pick<
  Database['public']['Tables']['player']['Row'],
  'id' | 'name' | 'birth_date'
>;
type Tournament = Pick<
  Database['public']['Tables']['tournament']['Row'],
  'id' | 'nazev' | 'misto' | 'datum'
>;

type Role = 'coach' | 'manager' | 'parent' | 'player';

export default function TripsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [appUserId, setAppUserId] = useState<string>('');
  const [role, setRole] = useState<Role | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        setUserEmail(user.email!);

        const { data: appUser } = await supabase
          .from('app_user')
          .select('id, role')
          .eq('email', user.email!)
          .single();

        if (!appUser) {
          router.push('/login');
          return;
        }

        setAppUserId(appUser.id);
        setRole(appUser.role as Role);

        // Hráči, které lze přidávat do výjezdu
        if (appUser.role === 'coach') {
          const { data } = await supabase
            .from('player')
            .select('id, name, birth_date')
            .eq('coach_id', appUser.id)
            .is('deleted_at', null)
            .order('name');
          setPlayers(data || []);
        } else if (appUser.role === 'manager') {
          const { data } = await supabase
            .from('player')
            .select('id, name, birth_date')
            .is('deleted_at', null)
            .order('name');
          setPlayers(data || []);
        }

        // Turnaje (pro volitelné propojení)
        if (appUser.role === 'coach' || appUser.role === 'manager') {
          const { data } = await supabase
            .from('tournament')
            .select('id, nazev, misto, datum')
            .order('datum', { ascending: true });
          setTournaments(data || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Načítání…</p>
      </div>
    );
  }

  if (!role) return null;

  const mode: TripsMode =
    role === 'coach' || role === 'manager' ? role : 'readonly';

  const backHref =
    role === 'coach'
      ? '/coach'
      : role === 'manager'
        ? '/manager'
        : role === 'parent'
          ? '/parent'
          : '/player';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                Tenisový klub – Výjezdy
              </h1>
              {userEmail && (
                <p className="break-all text-sm text-gray-600">{userEmail}</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <Link
                href={backHref}
                className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                ← Zpět na dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <TripsSection
          mode={mode}
          currentUserId={appUserId}
          assignablePlayers={players}
          tournaments={tournaments}
        />
      </main>
    </div>
  );
}

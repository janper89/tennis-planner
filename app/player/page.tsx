'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PlayerDashboard from '@/components/PlayerDashboard';
import type { Database } from '@/types/database';
import {
  getAgeFromBirthDate,
  getMaxTournamentsForAge,
} from '@/lib/utils';

type Player = Database['public']['Tables']['player']['Row'];
type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'] & {
  tournament: Tournament;
  player: Player;
};
type Coach = { id: string; email: string };

export default function PlayerPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [appUserId, setAppUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
          return;
        }

        setUserEmail(user.email!);

        const { data: appUser, error: appUserError } = await supabase
          .from('app_user')
          .select('id, name, role')
          .eq('email', user.email!)
          .single();

        if (!appUser || appUserError) {
          router.push('/login');
          return;
        }

        if (appUser.role !== 'player') {
          router.push('/login');
          return;
        }

        setAppUserId(appUser.id);
        setUserName(appUser.name?.trim() || '');

        const { data: coachesData } = await supabase
          .from('app_user')
          .select('id, email')
          .eq('role', 'coach')
          .order('email');

        setCoaches(
          (coachesData || []).map((c) => ({ id: c.id, email: c.email }))
        );

        const { data: playerData } = await supabase
          .from('player')
          .select('*')
          .eq('self_managed_by', appUser.id)
          .is('deleted_at', null)
          .maybeSingle();

        setPlayer(playerData || null);

        if (!playerData) {
          setEntries([]);
          setTournaments([]);
          setLoading(false);
          return;
        }

        const { data: entriesData } = await supabase
          .from('entry')
          .select(
            `
            *,
            tournament:tournament_id (*),
            player:player_id (*)
          `
          )
          .eq('player_id', playerData.id)
          .is('deleted_at', null)
          .order('tournament(datum)', { ascending: true });

        const tournamentIds =
          (entriesData as Entry[] | null)?.map((e) => e.tournament_id) || [];
        const { data: tournamentsData } = await supabase
          .from('tournament')
          .select('*')
          .in(
            'id',
            tournamentIds.length > 0
              ? tournamentIds
              : ['00000000-0000-0000-0000-000000000000']
          )
          .order('datum', { ascending: true });

        setEntries((entriesData as Entry[]) || []);
        setTournaments(tournamentsData || []);
      } catch {
        setLoading(false);
      } finally {
        setLoading(false);
      }
    }

    loadData();

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') loadData();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [router]);

  const handleCreateProfile = async (formData: FormData) => {
    if (!appUserId) return;
    setProfileLoading(true);
    try {
      const name = (formData.get('name') as string)?.trim();
      const birth_date = formData.get('birth_date') as string;
      const rocnik = parseInt(formData.get('rocnik') as string, 10);
      const category = (formData.get('category') as string)?.trim() || null;
      const coach_id = (formData.get('coach_id') as string) || null;

      if (!name || !birth_date || !rocnik) {
        alert('Vyplň jméno, datum narození a ročník.');
        setProfileLoading(false);
        return;
      }

      const birthDateObj = new Date(birth_date);
      if (birthDateObj > new Date()) {
        alert('Datum narození nemůže být v budoucnosti.');
        setProfileLoading(false);
        return;
      }

      const limit_turnaju = getMaxTournamentsForAge(
        getAgeFromBirthDate(birth_date)
      );

      const { error } = await createClient()
        .from('player')
        .insert({
          name,
          birth_date,
          rocnik,
          category,
          coach_id: coach_id || null,
          parent_id: null,
          self_managed_by: appUserId,
          limit_turnaju,
        });

      if (error) {
        alert('Chyba při vytváření profilu: ' + error.message);
        setProfileLoading(false);
        return;
      }

      window.location.reload();
    } catch (e) {
      console.error(e);
      alert('Došlo k chybě');
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Načítání...</p>
          <p className="mt-2 text-sm text-gray-500">Prosím čekej</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-gray-900">
              Tenisový klub – Hráč
            </h1>
            <p className="mt-1 text-sm text-gray-600">{userEmail}</p>
          </div>
        </header>
        <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="mb-4 text-xl font-semibold">Vytvoř si profil</h2>
            <p className="mb-6 text-sm text-gray-600">
              Jednou si vytvoř profil (jméno, datum narození, ročník, trenér).
              Potom můžeš přidávat turnaje a sledovat svůj plán.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await handleCreateProfile(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Jméno *
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Tvé jméno"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Datum narození *
                </label>
                <input
                  type="date"
                  name="birth_date"
                  required
                  max={new Date().toISOString().split('T')[0]}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Ročník *
                </label>
                <input
                  type="number"
                  name="rocnik"
                  required
                  min={1}
                  max={20}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Např. 2010"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Kategorie
                </label>
                <input
                  type="text"
                  name="category"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  placeholder="Např. U12"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Trenér
                </label>
                <select
                  name="coach_id"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="">Vyber trenéra</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.email}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={profileLoading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {profileLoading ? 'Vytvářím...' : 'Vytvořit profil'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <PlayerDashboard
      player={player}
      entries={entries}
      tournaments={tournaments}
      userEmail={userEmail}
      userName={userName}
    />
  );
}

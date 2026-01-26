'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ParentDashboard from '@/components/ParentDashboard';
import type { Database } from '@/types/database';

type Player = Database['public']['Tables']['player']['Row'];
type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'] & {
  tournament: Tournament;
  player: Player;
};
type Coach = {
  id: string;
  email: string;
};

export default function ParentPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        console.log('🔄 Starting to load data...');
        const supabase = createClient();
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        console.log('👤 Auth user:', { user: user?.email, error: authError });

        if (!user) {
          console.log('❌ No user, redirecting to login');
          router.push('/login');
          return;
        }

        setUserEmail(user.email!);
        console.log('📧 Set userEmail to:', user.email);

        // Get app_user record
        console.log('🔍 Fetching app_user from database...');
        const { data: appUser, error: appUserError } = await supabase
          .from('app_user')
          .select('id, name')
          .eq('email', user.email!)
          .single();

        console.log('📊 App user query result:', { 
          appUser, 
          error: appUserError,
          hasName: !!appUser?.name,
          nameValue: appUser?.name 
        });

        if (!appUser) {
          console.log('❌ No app_user found, redirecting to login');
          router.push('/login');
          return;
        }

        // Debug logging
        console.log('✅ App user loaded:', {
          id: appUser.id,
          name: appUser.name,
          nameType: typeof appUser.name,
          nameLength: appUser.name?.length,
          email: user.email,
        });

        // Set userName - handle both null and empty string
        const nameValue = appUser.name?.trim() || '';
        console.log('📝 Setting userName to:', nameValue, '(original:', appUser.name, ')');
        setUserName(nameValue);
        console.log('✅ userName state set to:', nameValue);

        // Get all coaches
        const { data: coachesData } = await supabase
          .from('app_user')
          .select('id, email')
          .eq('role', 'coach')
          .order('email');

        const coachesList = (coachesData || []).map((c) => ({
          id: c.id,
          email: c.email,
        }));

        // Get user's children (players)
        const { data: playersData } = await supabase
          .from('player')
          .select('*')
          .eq('parent_id', appUser.id)
          .order('name');

        // Get all entries for user's children
        const playerIds = playersData?.map((p) => p.id) || [];
        const { data: entriesData } = await supabase
          .from('entry')
          .select(
            `
            *,
            tournament:tournament_id (*),
            player:player_id (*)
          `
          )
          .in('player_id', playerIds.length > 0 ? playerIds : ['00000000-0000-0000-0000-000000000000'])
          .order('tournament(datum)', { ascending: true });

        // Get tournaments
        const tournamentIds = entriesData?.map((e) => e.tournament_id) || [];
        const { data: tournamentsData } = await supabase
          .from('tournament')
          .select('*')
          .in('id', tournamentIds.length > 0 ? tournamentIds : ['00000000-0000-0000-0000-000000000000'])
          .order('datum', { ascending: true });

        setPlayers(playersData || []);
        setEntries((entriesData as Entry[]) || []);
        setTournaments(tournamentsData || []);
        setCoaches(coachesList);
        
        // Debug logging
        console.log('Loaded data:', {
          playersCount: playersData?.length || 0,
          entriesCount: entriesData?.length || 0,
          tournamentsCount: tournamentsData?.length || 0,
          coachesCount: coachesList.length,
        });
      } catch (error) {
        console.error('❌ Error loading data:', error);
        // Don't redirect on error, show error state instead
        setLoading(false);
      } finally {
        console.log('🏁 Data loading finished');
        setLoading(false);
      }
    }

    console.log('🚀 useEffect triggered, calling loadData()');
    loadData();
  }, [router]);

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

  console.log('🎨 Rendering ParentDashboard with props:', {
    playersCount: players.length,
    entriesCount: entries.length,
    userName: userName,
    userEmail: userEmail,
    userNameType: typeof userName,
    userNameLength: userName?.length,
  });

  return (
    <ParentDashboard
      players={players}
      entries={entries}
      tournaments={tournaments}
      coaches={coaches}
      userEmail={userEmail}
      userName={userName}
    />
  );
}

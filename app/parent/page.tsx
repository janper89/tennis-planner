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

export default function ParentPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [userEmail, setUserEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
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

        // Get app_user record
        const { data: appUser } = await supabase
          .from('app_user')
          .select('id')
          .eq('email', user.email!)
          .single();

        if (!appUser) {
          router.push('/login');
          return;
        }

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
      } catch (error) {
        console.error('Error loading data:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-600">Načítání...</p>
      </div>
    );
  }

  return (
    <ParentDashboard
      players={players}
      entries={entries}
      tournaments={tournaments}
      userEmail={userEmail}
    />
  );
}

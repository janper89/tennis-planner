'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import ManagerDashboard from '@/components/ManagerDashboard';
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

export default function ManagerPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
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

        // Get all players
        const { data: playersData } = await supabase
          .from('player')
          .select('*')
          .order('name');

        // Get all coaches
        const { data: coachesData } = await supabase
          .from('app_user')
          .select('id, email')
          .eq('role', 'coach');

        const coachesList = (coachesData || []).map((c) => ({
          id: c.id,
          email: c.email,
        }));

        // Get all entries
        const { data: entriesData } = await supabase
          .from('entry')
          .select(
            `
            *,
            tournament:tournament_id (*),
            player:player_id (*)
          `
          )
          .order('tournament(datum)', { ascending: true });

        // Get all tournaments
        const tournamentIds = [
          ...new Set(entriesData?.map((e) => e.tournament_id) || []),
        ];
        const { data: tournamentsData } = await supabase
          .from('tournament')
          .select('*')
          .in('id', tournamentIds.length > 0 ? tournamentIds : ['00000000-0000-0000-0000-000000000000'])
          .order('datum', { ascending: true });

        setPlayers(playersData || []);
        setCoaches(coachesList);
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
    <ManagerDashboard
      players={players}
      coaches={coaches}
      entries={entries}
      tournaments={tournaments}
    />
  );
}

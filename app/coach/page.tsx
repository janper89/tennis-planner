'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import CoachDashboard from '@/components/CoachDashboard';
import type { Database } from '@/types/database';

type Player = Database['public']['Tables']['player']['Row'];
type Tournament = Database['public']['Tables']['tournament']['Row'];
type Entry = Database['public']['Tables']['entry']['Row'] & {
  tournament: Tournament;
  player: Player;
};

export default function CoachPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
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

        // Get coach's players
        const { data: playersData } = await supabase
          .from('player')
          .select('*')
          .eq('coach_id', appUser.id)
          .order('name');

        if (!playersData || playersData.length === 0) {
          setPlayers([]);
          setEntries([]);
          setTournaments([]);
          setLoading(false);
          return;
        }

        const playerIds = playersData.map((p) => p.id);

        // Get all entries for coach's players
        const { data: entriesData } = await supabase
          .from('entry')
          .select(
            `
            *,
            tournament:tournament_id (*),
            player:player_id (*)
          `
          )
          .in('player_id', playerIds)
          .order('tournament(datum)', { ascending: true });

        // Get unique tournaments
        const tournamentIds = [
          ...new Set(entriesData?.map((e) => e.tournament_id) || []),
        ];
        const { data: tournamentsData } = await supabase
          .from('tournament')
          .select('*')
          .in('id', tournamentIds.length > 0 ? tournamentIds : ['00000000-0000-0000-0000-000000000000'])
          .order('datum', { ascending: true });

        setPlayers(playersData);
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

  if (!players || players.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold">Trenér - Žádní hráči</h1>
          <p className="mt-4 text-gray-600">
            Zatím nemáš přiřazené žádné hráče.
          </p>
        </div>
      </div>
    );
  }

  return (
    <CoachDashboard
      players={players}
      entries={entries}
      tournaments={tournaments}
    />
  );
}

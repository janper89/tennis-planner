import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

export async function adjustManualPlayedAdjustment(
  supabase: SupabaseClient<Database>,
  playerId: string,
  delta: number
): Promise<number> {
  const { data, error: readError } = await supabase
    .from('player')
    .select('manual_played_adjustment')
    .eq('id', playerId)
    .is('deleted_at', null)
    .single();

  const player = data as Pick<
    Database['public']['Tables']['player']['Row'],
    'manual_played_adjustment'
  > | null;

  if (readError || !player) {
    throw new Error(readError?.message || 'Hráč nebyl nalezen');
  }

  const currentValue = Math.max(0, player.manual_played_adjustment ?? 0);
  const nextValue = Math.max(0, currentValue + delta);

  if (nextValue === currentValue) {
    return currentValue;
  }

  const { error: updateError } = await supabase
    .from('player')
    .update({ manual_played_adjustment: nextValue } as never)
    .eq('id', playerId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return nextValue;
}

'use client';

type TournamentFactsheetLike = {
  sign_in_deadline_text?: string | null;
  withdrawal_deadline_text?: string | null;
  tournament_director_name?: string | null;
  official_ball?: string | null;
  draw_size?: string | null;
};

interface TournamentFactsheetDetailsProps {
  tournament: TournamentFactsheetLike;
  className?: string;
}

export default function TournamentFactsheetDetails({
  tournament,
  className = '',
}: TournamentFactsheetDetailsProps) {
  const rows: Array<{ label: string; value?: string | null }> = [
    { label: 'Uzávěrka (ITF)', value: tournament.sign_in_deadline_text },
    { label: 'Odhlášení (ITF)', value: tournament.withdrawal_deadline_text },
    { label: 'Ředitel', value: tournament.tournament_director_name },
    { label: 'Míčky', value: tournament.official_ball },
    { label: 'Draw', value: tournament.draw_size },
  ];

  const visibleRows = rows.filter((row) => !!row.value && String(row.value).trim().length > 0);
  if (visibleRows.length === 0) return null;

  return (
    <div className={`mt-2 border-t border-gray-200 pt-2 text-xs text-gray-500 ${className}`}>
      {visibleRows.map((row) => (
        <p key={row.label}>
          <span className="font-medium">{row.label}:</span> {row.value}
        </p>
      ))}
    </div>
  );
}

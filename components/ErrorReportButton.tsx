'use client';

import { useState } from 'react';

type ReportType = 'missing_tournament' | 'other';

interface ErrorReportButtonProps {
  profileLabel: string;
  reporterEmail?: string;
}

export default function ErrorReportButton({
  profileLabel,
  reporterEmail = '',
}: ErrorReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ReportType>('missing_tournament');
  const [tournamentDate, setTournamentDate] = useState('');
  const [tournamentCategory, setTournamentCategory] = useState('');
  const [tournamentName, setTournamentName] = useState('');
  const [description, setDescription] = useState('');
  const [sending, setSending] = useState(false);

  const resetForm = () => {
    setType('missing_tournament');
    setTournamentDate('');
    setTournamentCategory('');
    setTournamentName('');
    setDescription('');
  };

  const closeModal = () => {
    if (sending) return;
    setOpen(false);
    resetForm();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;

    if (type === 'missing_tournament') {
      if (!tournamentDate || !tournamentCategory.trim() || !tournamentName.trim()) {
        alert('U chybějícího turnaje vyplň datum, kategorii a název.');
        return;
      }
    } else if (!description.trim()) {
      alert('Popiš prosím nahlášenou chybu.');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: type,
          profileLabel,
          reporterEmail,
          missingTournament:
            type === 'missing_tournament'
              ? {
                  date: tournamentDate,
                  category: tournamentCategory.trim(),
                  name: tournamentName.trim(),
                }
              : null,
          otherDescription: type === 'other' ? description.trim() : null,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        alert(data?.error || 'Nepodařilo se odeslat hlášení.');
        return;
      }

      alert('Díky, hlášení bylo odesláno.');
      closeModal();
    } catch (error) {
      console.error('[ErrorReportButton] submit failed', error);
      alert('Došlo k chybě při odesílání.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800 hover:bg-amber-200"
      >
        Nahlášení chyby
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Nahlásit chybu</h3>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Typ hlášení
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ReportType)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                >
                  <option value="missing_tournament">Chybějící turnaj</option>
                  <option value="other">Další chyba</option>
                </select>
              </div>

              {type === 'missing_tournament' ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Datum *</label>
                    <input
                      type="date"
                      value={tournamentDate}
                      onChange={(e) => setTournamentDate(e.target.value)}
                      required
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Kategorie *</label>
                    <input
                      type="text"
                      value={tournamentCategory}
                      onChange={(e) => setTournamentCategory(e.target.value)}
                      required
                      placeholder="Např. J60 / U16 / UTR"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Název turnaje *</label>
                    <input
                      type="text"
                      value={tournamentName}
                      onChange={(e) => setTournamentName(e.target.value)}
                      required
                      placeholder="Název turnaje"
                      className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Popis chyby *
                  </label>
                  <textarea
                    rows={5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Co přesně je špatně?"
                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Zrušit
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {sending ? 'Odesílám...' : 'Odeslat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

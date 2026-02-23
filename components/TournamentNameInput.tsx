'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { searchTournamentsByName } from '@/lib/tournament-service';
import { formatDate } from '@/lib/utils';
import type { ITFTournamentSearchResult } from '@/lib/tournament-service';

const DEBOUNCE_MS = 300;

interface TournamentNameInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (tournament: ITFTournamentSearchResult) => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function TournamentNameInput({
  value,
  onChange,
  onSelect,
  name = 'nazev',
  placeholder = 'Zadejte část názvu turnaje...',
  required = false,
  className = '',
  disabled = false,
}: TournamentNameInputProps) {
  const [suggestions, setSuggestions] = useState<ITFTournamentSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  const fetchSuggestions = useCallback(
    async (query: string) => {
      const trimmedQuery = query.trim();
      if (!trimmedQuery || trimmedQuery.length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const results = await searchTournamentsByName(supabase, trimmedQuery, 20);
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setHighlightedIndex(-1);
        if (results.length === 0 && trimmedQuery.length >= 2) {
          setError('Žádné turnaje nenalezeny');
        }
      } catch (error) {
        console.error('Error fetching tournament suggestions:', error);
        const errorMessage = error instanceof Error ? error.message : 'Chyba při vyhledávání';
        setError(`Chyba: ${errorMessage}`);
        setSuggestions([]);
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmedValue = value.trim();
      if (!trimmedValue || trimmedValue.length < 2) {
        setSuggestions([]);
        setIsOpen(false);
        setError(null);
        return;
      }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, fetchSuggestions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Použij click místo mousedown, aby se dropdown nezavřel před výběrem itemu
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    // Použij click event s capture phase, aby se zachytil i když je dropdown otevřený
    document.addEventListener('click', handleClickOutside, true);
    return () => document.removeEventListener('click', handleClickOutside, true);
  }, []);

  const handleSelect = (tournament: ITFTournamentSearchResult) => {
    onChange(tournament.name);
    onSelect?.(tournament);
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'Escape') setIsOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((i) => (i < suggestions.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((i) => (i > 0 ? i - 1 : -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        handleSelect(suggestions[highlightedIndex]);
      } else if (suggestions.length > 0) {
        handleSelect(suggestions[0]);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => {
          // Když uživatel klikne zpět do inputu, zobraz dropdown pokud jsou suggestions nebo pokud se načítají
          if (value.trim().length >= 2) {
            if (suggestions.length > 0) {
              setIsOpen(true);
            } else if (!loading) {
              // Pokud nejsou suggestions a není loading, zkus načíst znovu
              fetchSuggestions(value);
            }
          }
        }}
        onKeyDown={handleKeyDown}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={className}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          Hledám...
        </div>
      )}
      {error && !loading && value.trim().length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 shadow-lg">
          {error}
        </div>
      )}
      {!loading && !error && value.trim().length >= 2 && !isOpen && suggestions.length === 0 && value.trim() && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
          Žádné turnaje nenalezeny
        </div>
      )}
      {isOpen && suggestions.length > 0 && (
        <ul
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-lg"
          role="listbox"
        >
          {suggestions.map((t, i) => (
            <li
              key={t.tournamentKey}
              role="option"
              aria-selected={i === highlightedIndex}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
              onMouseEnter={() => setHighlightedIndex(i)}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSelect(t);
              }}
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-gray-500">
                {' '}
                – {t.city} – {formatDate(t.startDate)}
                {t.category ? ` (${t.category})` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

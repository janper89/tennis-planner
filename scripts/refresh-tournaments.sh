#!/bin/bash
# Obnoví turnajový kalendář hybridně:
# - search cache horizont (autocomplete): CACHE_WINDOW_MONTHS_SEARCH, default 18 měsíců
# - factsheet enrichment (planning): CACHE_WINDOW_MONTHS_PLANNING, default 6 měsíců
# Spouštět ručně nebo přes cron (např. 1. den v měsíci).
#
# Použití:
#   ./scripts/refresh-tournaments.sh
#   ./scripts/refresh-tournaments.sh --no-import   # bez importu do DB
#
# Cron (1. den v měsíci v 6:00):
#   0 6 1 * * cd /cesta/k/tennis-club && ./scripts/refresh-tournaments.sh

set -e
cd "$(dirname "$0")/.."

echo "=== refresh-tournaments.sh $(date) ==="
SEARCH_WINDOW_MONTHS="${CACHE_WINDOW_MONTHS_SEARCH:-18}"
PLANNING_WINDOW_MONTHS="${CACHE_WINDOW_MONTHS_PLANNING:-6}"

echo "1. Stahuji kalendář (${SEARCH_WINDOW_MONTHS} měsíců dopředu)..."
node scripts/fetch-calendar-itf-juniors.js --months="${SEARCH_WINDOW_MONTHS}"
node scripts/validate-tournament-cache.js data/tournament-cache.json

echo "2. Stahuji factsheety a slučuji..."
if [[ "$*" == *"--no-import"* ]]; then
  node scripts/fetch-factsheets-bulk.js --planning-window-months="${PLANNING_WINDOW_MONTHS}" --search-window-months="${SEARCH_WINDOW_MONTHS}"
  node scripts/validate-tournament-cache.js data/tournament-cache-full.json
  echo "Hotovo (bez importu)."
else
  node scripts/fetch-factsheets-bulk.js --import --planning-window-months="${PLANNING_WINDOW_MONTHS}" --search-window-months="${SEARCH_WINDOW_MONTHS}"
  echo "Import do Supabase dokončen."
  echo "3. Post-import sanity check..."
  node scripts/post-import-sanity.js "${SEARCH_WINDOW_MONTHS}" || echo "Post-import sanity: varování výše, nezabíjím běh."
fi

echo "=== Konec ==="

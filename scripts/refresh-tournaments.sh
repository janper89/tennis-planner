#!/bin/bash
# Obnoví turnajový kalendář v minimal modu:
# - search cache horizont (autocomplete): CACHE_WINDOW_MONTHS_SEARCH, default 4 měsíce
# - factsheet enrichment vypnutý (draw_size, deadlines, ball atd. se v UI nepoužívají).
# Spouštět ručně nebo přes cron (např. 1. den v měsíci).
#
# Bezpečnost: import do DB je čistě upsert (žádné řádky se nemažou). Window-diff
# cleanup ani --replace-all se odsud NEVOLAJÍ, aby nekompletní ITF scrape nikdy
# nemohl tiše smazat existující data v tournament_cache.
#
# Použití:
#   ./scripts/refresh-tournaments.sh
#   ./scripts/refresh-tournaments.sh --no-import   # bez importu do DB
#   ./scripts/refresh-tournaments.sh --with-factsheets   # volitelně pustí i legacy factsheet pipeline
#
# Cron (1. den v měsíci v 6:00):
#   0 6 1 * * cd /cesta/k/tennis-club && ./scripts/refresh-tournaments.sh

set -e
cd "$(dirname "$0")/.."

echo "=== refresh-tournaments.sh $(date) ==="
SEARCH_WINDOW_MONTHS="${CACHE_WINDOW_MONTHS_SEARCH:-4}"
PLANNING_WINDOW_MONTHS="${CACHE_WINDOW_MONTHS_PLANNING:-6}"

WITH_FACTSHEETS=0
NO_IMPORT=0
for arg in "$@"; do
  case "$arg" in
    --with-factsheets) WITH_FACTSHEETS=1 ;;
    --no-import) NO_IMPORT=1 ;;
  esac
done

echo "1. Stahuji kalendář (${SEARCH_WINDOW_MONTHS} měsíců dopředu)..."
node scripts/fetch-calendar-itf-juniors.js --months="${SEARCH_WINDOW_MONTHS}"
node scripts/validate-tournament-cache.js data/tournament-cache.json

if [[ "$WITH_FACTSHEETS" == "1" ]]; then
  echo "2. [legacy] Stahuji factsheety a slučuji..."
  if [[ "$NO_IMPORT" == "1" ]]; then
    node scripts/fetch-factsheets-bulk.js --planning-window-months="${PLANNING_WINDOW_MONTHS}" --search-window-months="${SEARCH_WINDOW_MONTHS}"
    node scripts/validate-tournament-cache.js data/tournament-cache-full.json
    echo "Hotovo (bez importu, s factsheety)."
  else
    node scripts/fetch-factsheets-bulk.js --import --planning-window-months="${PLANNING_WINDOW_MONTHS}" --search-window-months="${SEARCH_WINDOW_MONTHS}"
    echo "Import do Supabase dokončen (factsheet pipeline)."
    echo "3. Post-import sanity check..."
    node scripts/post-import-sanity.js "${SEARCH_WINDOW_MONTHS}" || echo "Post-import sanity: varování výše, nezabíjím běh."
  fi
else
  if [[ "$NO_IMPORT" == "1" ]]; then
    echo "2. Hotovo (bez importu, minimal mode – factsheet enrichment vynechán)."
  else
    echo "2. Importuji kalendář do Supabase (minimal mode – bez factsheet enrichmentu)..."
    node scripts/import-tournament-cache.js data/tournament-cache.json --from-today --window-months="${SEARCH_WINDOW_MONTHS}"
    echo "3. Post-import sanity check..."
    node scripts/post-import-sanity.js "${SEARCH_WINDOW_MONTHS}" || echo "Post-import sanity: varování výše, nezabíjím běh."
  fi
fi

echo "=== Konec ==="

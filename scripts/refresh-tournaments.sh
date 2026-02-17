#!/bin/bash
# Obnoví turnajový kalendář na 3 měsíce dopředu a naimportuje do Supabase.
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
echo "1. Stahuji kalendář (3 měsíce dopředu)..."
node scripts/fetch-calendar-itf-juniors.js

echo "2. Stahuji factsheety a slučuji..."
if [[ "$*" == *"--no-import"* ]]; then
  node scripts/fetch-factsheets-bulk.js
  echo "Hotovo (bez importu)."
else
  node scripts/fetch-factsheets-bulk.js --import
  echo "Import do Supabase dokončen."
fi

echo "=== Konec ==="

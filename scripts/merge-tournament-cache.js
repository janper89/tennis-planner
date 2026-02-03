/**
 * Sloučí dva JSON soubory s turnaji (pole objektů) podle tournament_key/tournamentKey.
 * Pozdější záznam (v druhém souboru) přepíše starší při stejném klíči.
 *
 * Použití:
 *   node scripts/merge-tournament-cache.js <soubor1.json> <soubor2.json> [vystup.json]
 *
 * Pokud vystup.json není zadán, vypíše na stdout.
 */

const fs = require('fs');
const path = require('path');

function getKey(item) {
  return (item.tournament_key ?? item.tournamentKey ?? '').toString();
}

function loadArray(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  return Array.isArray(data) ? data : [data];
}

function main() {
  const [file1, file2, outPath] = process.argv.slice(2);
  if (!file1 || !file2) {
    console.error('Použití: node scripts/merge-tournament-cache.js <soubor1.json> <soubor2.json> [vystup.json]');
    process.exit(1);
  }

  const list1 = loadArray(file1);
  const list2 = loadArray(file2);
  const byKey = new Map();

  for (const item of list1) {
    const k = getKey(item);
    if (k) byKey.set(k, item);
  }
  for (const item of list2) {
    const k = getKey(item);
    if (k) byKey.set(k, item);
  }

  const merged = Array.from(byKey.values());
  const out = JSON.stringify(merged, null, 2);

  if (outPath) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, out, 'utf8');
    console.log('Sloučeno', merged.length, 'turnajů do', outPath);
  } else {
    process.stdout.write(out);
  }
}

main();

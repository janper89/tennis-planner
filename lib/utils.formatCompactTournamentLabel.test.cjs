const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

function loadUtilsModule() {
  const utilsPath = path.resolve(__dirname, 'utils.ts');
  const source = fs.readFileSync(utilsPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: utilsPath,
  });

  const compiledModule = new Module(utilsPath, module);
  compiledModule.filename = utilsPath;
  compiledModule.paths = Module._nodeModulePaths(path.dirname(utilsPath));
  compiledModule._compile(transpiled.outputText, utilsPath);
  return compiledModule.exports;
}

const { formatCompactTournamentLabel } = loadUtilsModule();

test('JGS with tournamentKey renders JGS city', () => {
  const label = formatCompactTournamentLabel(
    'N/A',
    'Paris',
    'Roland Garros Junior Championships',
    'J-JGS-FRA-2026-001'
  );
  assert.equal(label, 'JGS Paris');
});

test('JGS with category renders JGS city', () => {
  const label = formatCompactTournamentLabel(
    'JGS',
    'Paris',
    'Roland Garros Junior Championships'
  );
  assert.equal(label, 'JGS Paris');
});

test('Regular category renders category and city', () => {
  const label = formatCompactTournamentLabel('J100', 'Prague', 'J100 PRAGUE');
  assert.equal(label, 'J100 Prague');
});

test('N/A category outside JGS renders city only', () => {
  const label = formatCompactTournamentLabel(
    'N/A',
    'Prague',
    'Some Tournament',
    'J-J100-CZE-2026-001'
  );
  assert.equal(label, 'Prague');
});

test('Null category outside JGS renders city only', () => {
  const label = formatCompactTournamentLabel(
    null,
    'Prague',
    'Some Tournament',
    'J-J100-CZE-2026-001'
  );
  assert.equal(label, 'Prague');
});

test('Missing city falls back to tournament name', () => {
  const label = formatCompactTournamentLabel('J100', '', 'Roland Garros Junior Championships');
  assert.equal(label, 'Roland Garros Junior Championships');
});

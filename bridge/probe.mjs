// Fase 0: prova de vida. Carrega o engine Micropolis (WASM) headless no Node,
// abre uma cidade de exemplo, avanca o tempo e le o estado.
//
// Duas armadilhas resolvidas aqui:
//
// 1. O bundle do Emscripten resolve o pacote pre-carregado (micropolisengine.data,
//    que embute as cidades .cty) relativo ao diretorio de trabalho, nao ao do
//    modulo. Por isso entramos no diretorio do build antes de inicializar.
//
// 2. O engine exige um callback de frontend registrado ANTES de init(). Sem ele,
//    a primeira chamada que tenta notificar a interface escreve fora da memoria
//    do WASM e derruba o processo. A ordem correta e:
//        setCallback -> init -> loadCity -> simTick
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BUILD = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../vendor/MicropolisCore/packages/micropolis-engine/build',
);

// Os nomes vem de apps/micropolis/src/lib/wasm/callbacks.ts do upstream.
const METODOS_CALLBACK = [
  'autoGoto','didGenerateMap','didLoadCity','didLoadScenario','didLoseGame','didSaveCity',
  'didTool','didWinGame','didntLoadCity','didntSaveCity','makeSound','newGame','saveCityAs',
  'sendMessage','showBudgetAndWait','showZoneStatus','simulateRobots','simulateChurch',
  'startEarthquake','startGame','startScenario','updateBudget','updateCityName','updateDate',
  'updateDemand','updateEvaluation','updateFunds','updateGameLevel','updateHistory','updateMap',
  'updateOptions','updatePasses','updatePaused','updateSpeed','updateTaxRate',
];

const anterior = process.cwd();
process.chdir(BUILD);
const initEngine = (await import(path.join(BUILD, 'micropolisengine.js'))).default;
const engine = await initEngine();
process.chdir(anterior);

const m = new engine.Micropolis();
m.setCallback(new engine.JSCallback(
  Object.fromEntries(METODOS_CALLBACK.map((n) => [n, () => {}])),
), {});
m.init();

const cidade = '/cities/haight.cty';
const carregou = m.loadCity(cidade);
console.log(`cidade ${cidade}: ${carregou ? 'carregada' : 'FALHOU'}`);

const ler = () => ({
  ano: 1900 + Math.floor(m.cityTime / 48),
  fundos: m.totalFunds,
  populacao: m.cityPop,
  pontuacao: m.cityScore,
  imposto: m.cityTax,
  poluicao: m.pollutionAverage,
  crime: m.crimeAverage,
  transito: m.trafficAverage,
});

console.log('estado inicial :', JSON.stringify(ler()));
for (let i = 0; i < 500; i++) m.simTick();
console.log('apos 500 ticks :', JSON.stringify(ler()));

m.delete();

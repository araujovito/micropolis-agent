// Carga do engine Micropolis (WASM) para uso headless.
//
// Isolado num modulo porque duas armadilhas precisam ser tratadas sempre, e
// esquecer qualquer uma delas derruba o processo em vez de dar erro legivel.
// Ver docs/01-ambiente.md.
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BUILD = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../vendor/MicropolisCore/packages/micropolis-engine/build',
);

// Nomes vindos de apps/micropolis/src/lib/wasm/callbacks.ts (upstream).
const METODOS_CALLBACK = [
  'autoGoto','didGenerateMap','didLoadCity','didLoadScenario','didLoseGame','didSaveCity',
  'didTool','didWinGame','didntLoadCity','didntSaveCity','makeSound','newGame','saveCityAs',
  'sendMessage','showBudgetAndWait','showZoneStatus','simulateRobots','simulateChurch',
  'startEarthquake','startGame','startScenario','updateBudget','updateCityName','updateDate',
  'updateDemand','updateEvaluation','updateFunds','updateGameLevel','updateHistory','updateMap',
  'updateOptions','updatePasses','updatePaused','updateSpeed','updateTaxRate',
];

let engineCache = null;

/** Carrega o modulo WASM uma vez por processo. */
export async function carregarEngine() {
  if (engineCache) return engineCache;
  // O bundle resolve micropolisengine.data (que embute as cidades .cty) relativo
  // ao diretorio de trabalho, nao ao do modulo.
  const anterior = process.cwd();
  process.chdir(BUILD);
  try {
    const init = (await import(path.join(BUILD, 'micropolisengine.js'))).default;
    engineCache = await init();
  } finally {
    process.chdir(anterior);
  }
  return engineCache;
}

/**
 * Cria uma instancia pronta para simular.
 * A ordem setCallback -> init -> loadCity e obrigatoria: o engine notifica o
 * frontend durante init e, sem callback, escreve fora da memoria do WASM.
 */
export async function novaCidade(cidade = '/cities/haight.cty') {
  const engine = await carregarEngine();
  const m = new engine.Micropolis();
  m.setCallback(
    new engine.JSCallback(Object.fromEntries(METODOS_CALLBACK.map((n) => [n, () => {}]))),
    {},
  );
  m.init();
  const carregou = m.loadCity(cidade);
  if (!carregou) throw new Error(`nao consegui carregar a cidade ${cidade}`);
  return { engine, m };
}

/** Nome do acessor gerado pelo nosso patch de bindings. */
const acessor = (nome) => 'get' + nome[0].toUpperCase() + nome.slice(1);

/**
 * Le um overlay inteiro numa matriz [linha][coluna].
 *
 * O engine guarda os mapas em resolucoes reduzidas (cluster 2, 4 ou 8), que sao
 * as grades em que o proprio simulador raciocina. Devolvemos as dimensoes junto
 * porque elas variam por mapa.
 */
export function lerOverlay(m, nome) {
  const mapa = m[acessor(nome)]();
  const largura = mapa.MAP_W;
  const altura = mapa.MAP_H;
  const celulas = [];
  for (let y = 0; y < altura; y++) {
    const linha = [];
    for (let x = 0; x < largura; x++) linha.push(mapa.get(x, y));
    celulas.push(linha);
  }
  return { nome, largura, altura, cluster: mapa.MAP_BLOCKSIZE, celulas };
}

const RAMPA = '.123456789';

/**
 * Renderiza um overlay como grade de caracteres, com eixos rotulados.
 *
 * Caracteres em vez de JSON porque a grade preserva a vizinhanca espacial na
 * propria forma do texto: linhas adjacentes ficam adjacentes na tela. Um array
 * de arrays diz os mesmos numeros mas desmancha a figura.
 */
export function grade(overlay, { maximo } = {}) {
  const teto = maximo ?? Math.max(1, ...overlay.celulas.flat());
  const larguraRotulo = String(overlay.altura - 1).length;
  const linhas = overlay.celulas.map((linha, y) => {
    const corpo = linha
      .map((v) => RAMPA[Math.min(RAMPA.length - 1, Math.round((v / teto) * (RAMPA.length - 1)))])
      .join('');
    return String(y).padStart(larguraRotulo) + ' ' + corpo;
  });
  const dezenas = ' '.repeat(larguraRotulo + 1) +
    Array.from({ length: overlay.largura }, (_, x) => (x % 10 === 0 ? String((x / 10) % 10) : ' ')).join('');
  return [
    `${overlay.nome} (${overlay.largura}x${overlay.altura}, cluster ${overlay.cluster}, max ${teto})`,
    dezenas,
    ...linhas,
  ].join('\n');
}

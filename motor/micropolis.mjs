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

/**
 * Carrega o modulo WASM uma vez por processo.
 *
 * Cuidado: `process.chdir` e global ao processo. A troca dura apenas o tempo da
 * inicializacao e e desfeita no `finally`, mas nao chame isto em paralelo com
 * codigo sensivel ao diretorio de trabalho.
 */
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
// Mapas com sinal (rateOfGrowthMap vai de -61 a +93) precisam de rampa propria:
// numa rampa so positiva o declinio de um bairro vira vazio, que e exatamente o
// sinal que interessa. Minusculas para queda, maiusculas para alta, zero no meio.
const RAMPA_NEG = 'edcba';
const RAMPA_POS = 'ABCDE';

/**
 * Renderiza um overlay como grade de caracteres, com eixos rotulados.
 *
 * Caracteres em vez de JSON porque a grade preserva a vizinhanca espacial na
 * propria forma do texto: linhas adjacentes ficam adjacentes na tela. Um array
 * de arrays diz os mesmos numeros mas desmancha a figura.
 */
export function grade(overlay, { maximo } = {}) {
  const valores = overlay.celulas.flat();
  const temNegativo = valores.some((v) => v < 0);
  const teto = maximo ?? Math.max(1, ...valores.map(Math.abs));

  const simbolo = temNegativo
    ? (v) => {
        if (v === 0) return '0';
        const escala = Math.min(1, Math.abs(v) / teto);
        const rampa = v < 0 ? RAMPA_NEG : RAMPA_POS;
        const i = Math.min(rampa.length - 1, Math.floor(escala * rampa.length));
        return rampa[i];
      }
    : (v) => RAMPA[Math.min(RAMPA.length - 1, Math.round((v / teto) * (RAMPA.length - 1)))];

  const larguraRotulo = String(overlay.altura - 1).length;
  const linhas = overlay.celulas.map(
    (linha, y) => String(y).padStart(larguraRotulo) + ' ' + linha.map(simbolo).join(''),
  );
  const dezenas =
    ' '.repeat(larguraRotulo + 1) +
    Array.from({ length: overlay.largura }, (_, x) => (x % 10 === 0 ? String((x / 10) % 10) : ' ')).join('');
  const legenda = temNegativo
    ? `${overlay.nome} (${overlay.largura}x${overlay.altura}, cluster ${overlay.cluster}, |max| ${teto}; a-e queda, A-E alta, 0 estavel)`
    : `${overlay.nome} (${overlay.largura}x${overlay.altura}, cluster ${overlay.cluster}, max ${teto})`;
  return [legenda, dezenas, ...linhas].join('\n');
}

/**
 * Camada 1 da observacao: os escalares.
 *
 * `cityYear` e `cityMonth` vem prontos do engine — nao recalculamos a data a
 * partir de `cityTime`. A conta do engine e `cityTime/48 + startingYear`, mas ela
 * so e refeita dentro de `simTick`, entao os campos ficam defasados numa cidade
 * recem-carregada que ainda nao avancou.
 *
 * `anosAteQuebrar` existe porque o fracasso de longo prazo relatado no trabalho
 * anterior (25% de falencias) nao se conserta com mais mapa: o modelo enxerga o
 * saldo e nao consegue integrar o custo de manutencao no tempo. Entregamos a
 * derivada, que ele nao deriva sozinho. Ver docs/02-observacao.md para a objecao
 * de que isso pode ser uma muleta.
 */
// Ordem de micropolis.h: enum CityClass.
const CLASSES = ['vilarejo', 'vila', 'cidade', 'capital', 'metropole', 'megalopole'];

export function lerEscalares(m) {
  const fluxo = m.cashFlow;
  return {
    ano: m.cityYear,
    mes: m.cityMonth,
    caixa: m.totalFunds,
    fluxoAnual: fluxo,
    anosAteQuebrar: fluxo < 0 ? Math.floor(m.totalFunds / -fluxo) : null,
    imposto: m.cityTax,
    populacao: m.cityPop,
    pontuacao: m.cityScore,
    // cityClass chega como enum do Embind, nao como numero: o valor esta em
    // `.value` e um JSON.stringify direto do objeto devolve `{}` silenciosamente.
    classe: CLASSES[m.cityClass.value] ?? `desconhecida(${m.cityClass.value})`,
    residencial: m.resPop,
    comercial: m.comPop,
    industrial: m.indPop,
    // As valvulas RCI sao a demanda reprimida: positiva puxa crescimento daquele
    // tipo de zona, negativa indica excesso.
    demanda: { residencial: m.resValve, comercial: m.comValve, industrial: m.indValve },
    medias: {
      poluicao: m.pollutionAverage,
      crime: m.crimeAverage,
      valorDaTerra: m.landValueAverage,
      transito: m.trafficAverage,
    },
  };
}

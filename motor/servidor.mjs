// Servidor stdio: mantem uma cidade viva num processo Node e responde a comandos
// vindos do agente Python, um JSON por linha em cada direcao.
//
// Por que um processo de vida longa, e nao um CLI chamado a cada decisao: a
// cidade tem de persistir entre as decisoes. Salvar em .cty e recarregar a cada
// tick pagaria a carga do WASM toda vez e faria o estado passar por um formato
// de arquivo que nao foi feito para round-trip — qualquer coisa que o .cty nao
// guarde viraria uma diferenca silenciosa entre uma decisao e a seguinte.
//
// O protocolo e JSON-lines em vez de HTTP porque nao ha nada para servir: um
// unico cliente, ligado por pipe, sem porta, sem concorrencia. Ver agente/ponte.py.
//
// As respostas saem pelo **descritor 3**, nao pelo stdout. O engine compilado
// tem `printf` de depuracao que nao da para desligar de fora ("initdestroyMapArrays:
// mapBase: 0x27680" aparece a cada `init`), e ele cai no stdout no meio das nossas
// linhas. Filtrar no cliente o que "nao parece JSON" funcionaria ate o dia em que
// o engine imprimisse algo que parece — melhor dar ao protocolo um canal que
// ninguem mais escreve. stdout e stderr ficam livres para o barulho do engine.
import fs from 'node:fs';
import readline from 'node:readline';
import { novaCidade, lerEscalares, lerOverlay, grade } from './micropolis.mjs';

// As camadas espaciais da observacao, na ordem em que o agente as recebe.
// Fixa aqui, e nao escolhida pelo cliente, porque a composicao da observacao e a
// variavel do experimento: ela pertence ao codigo versionado, nao a uma flag.
const CAMADAS = [
  'pollutionDensityMap',
  'landValueMap',
  'populationDensityMap',
  'crimeRateMap',
  'trafficDensityMap',
  'rateOfGrowthMap',
  'policeStationEffectMap',
];

let estado = null; // { m, cidade, ticks }

const COMANDOS = {
  /** Carrega (ou recarrega) uma cidade. Descarta a anterior. */
  async abrir({ cidade = '/cities/haight.cty' }) {
    if (estado) estado.m.delete();
    const { m } = await novaCidade(cidade);
    estado = { m, cidade, ticks: 0 };
    return { cidade, ticks: 0 };
  },

  /** Avanca a simulacao n ticks. */
  avancar({ n = 1 }) {
    const { m } = exigirCidade();
    for (let i = 0; i < n; i++) m.simTick();
    estado.ticks += n;
    return { ticks: estado.ticks };
  },

  /**
   * A observacao completa: camada 1 (escalares) e camada 2 (grades).
   *
   * `updateMaps` antes de ler nao e opcional: os mapas agregados so sao
   * recalculados sob demanda, e sem isso o agente le a cidade de varios ticks
   * atras enquanto os escalares vem do tick atual — uma incoerencia que apareceria
   * como raciocinio ruim do modelo, e nao como bug nosso.
   */
  observar() {
    const { m } = exigirCidade();
    m.updateMaps();
    const grades = {};
    for (const nome of CAMADAS) grades[nome] = grade(lerOverlay(m, nome));
    return { cidade: estado.cidade, ticks: estado.ticks, escalares: lerEscalares(m), grades };
  },

  /** Encerra o processo. O cliente nao precisa esperar resposta. */
  encerrar() {
    if (estado) estado.m.delete();
    estado = null;
    setImmediate(() => process.exit(0));
    return { adeus: true };
  },
};

function exigirCidade() {
  if (!estado) throw new Error('nenhuma cidade aberta: mande "abrir" antes');
  return estado;
}

// Qual descritor, o cliente e quem diz: `subprocess` do Python herda os
// descritores com o numero que eles ja tinham no pai, sem remapear para 3, entao
// combinar o numero por variavel de ambiente evita um `preexec_fn` so para isso.
const CANAL = Number(process.env.MICROPOLIS_FD ?? 3);
try {
  fs.fstatSync(CANAL);
} catch {
  console.error(
    `servidor.mjs escreve o protocolo no descritor ${CANAL}, que nao foi aberto.\n` +
      'Pelo shell:  node motor/servidor.mjs 3>&1 1>/dev/null\n' +
      'Do Python:   ver agente/ponte.py',
  );
  process.exit(2);
}

// writeSync, e nao um stream: a escrita precisa terminar antes de `process.exit`
// no comando `encerrar`, e um stream bufferizado pode perder a ultima linha.
const responder = (obj) => fs.writeSync(CANAL, JSON.stringify(obj) + '\n');

const entrada = readline.createInterface({ input: process.stdin });
for await (const linha of entrada) {
  if (!linha.trim()) continue;
  let pedido;
  try {
    pedido = JSON.parse(linha);
  } catch {
    responder({ ok: false, erro: 'linha nao e JSON valido' });
    continue;
  }
  const comando = COMANDOS[pedido.cmd];
  if (!comando) {
    responder({ ok: false, id: pedido.id, erro: `comando desconhecido: ${pedido.cmd}` });
    continue;
  }
  try {
    responder({ ok: true, id: pedido.id, ...(await comando(pedido)) });
  } catch (e) {
    // Erro do engine nao derruba o servidor: o agente decide se tenta de novo.
    responder({ ok: false, id: pedido.id, erro: String(e?.message ?? e) });
  }
}

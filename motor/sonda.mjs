// Teste de fumaca: o engine sobe, a cidade carrega e o tempo anda?
// Se isto falhar, nada mais adiante faz sentido depurar.
import { novaCidade } from './micropolis.mjs';

const { m } = await novaCidade('/cities/haight.cty');

const ler = () => ({
  tempo: m.cityTime,
  fundos: m.totalFunds,
  populacao: m.cityPop,
  pontuacao: m.cityScore,
  poluicao: m.pollutionAverage,
  transito: m.trafficAverage,
});

console.log('inicial      :', JSON.stringify(ler()));
for (let i = 0; i < 500; i++) m.simTick();
console.log('+500 ticks   :', JSON.stringify(ler()));
m.delete();

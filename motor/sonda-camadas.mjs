// Sonda: imprime a observacao completa de uma cidade — camada 1 (escalares) e
// camada 2 (grades de caracteres). E o material bruto que o agente recebera.
import { novaCidade, lerEscalares, lerOverlay, grade } from './micropolis.mjs';

const CIDADE = process.argv[2] ?? '/cities/haight.cty';
const TICKS = Number(process.argv[3] ?? 500);

const { m } = await novaCidade(CIDADE);
for (let i = 0; i < TICKS; i++) m.simTick();
m.updateMaps();

console.log(`# ${CIDADE}, apos ${TICKS} ticks\n`);
console.log('## camada 1: escalares\n');
console.log(JSON.stringify(lerEscalares(m), null, 1));

console.log('\n## camada 2: grades\n');
for (const nome of ['pollutionDensityMap', 'landValueMap', 'populationDensityMap',
                    'crimeRateMap', 'rateOfGrowthMap', 'policeStationEffectMap']) {
  console.log(grade(lerOverlay(m, nome)));
  console.log();
}

m.delete();

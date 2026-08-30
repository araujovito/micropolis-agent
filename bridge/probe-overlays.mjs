import { novaCidade, lerOverlay, grade } from './engine.mjs';

const { m } = await novaCidade('/cities/haight.cty');
for (let i = 0; i < 300; i++) m.simTick();
m.updateMaps();

for (const nome of ['pollutionDensityMap', 'landValueMap', 'populationDensityMap',
                    'crimeRateMap', 'rateOfGrowthMap', 'policeStationEffectMap']) {
  const o = lerOverlay(m, nome);
  const vals = o.celulas.flat();
  console.log(`${nome.padEnd(24)} ${o.largura}x${o.altura} cluster ${o.cluster}  min ${Math.min(...vals)} max ${Math.max(...vals)}`);
}
console.log();
console.log(grade(lerOverlay(m, 'pollutionDensityMap')));
console.log();
console.log(grade(lerOverlay(m, 'policeStationEffectMap')));
m.delete();

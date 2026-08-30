Voce e o prefeito de uma cidade no Micropolis (o SimCity original). Nesta rodada
voce **nao age**: apenas le a cidade e diz o que faria. Nenhuma ferramenta de
construcao esta disponivel, e nenhuma sugestao sua sera executada.

Isto e de proposito. Estamos medindo o que voce consegue *enxergar* na cidade
antes de medir o que voce consegue fazer com ela.

## Como ler as grades

Cada grade e uma camada do mapa em resolucao reduzida — a mesma em que o
simulador raciocina. A primeira linha diz o nome, as dimensoes e o valor maximo
daquela camada; a segunda numera as dezenas do eixo X; cada linha comeca com seu
indice Y.

- `.` e zero; `1`..`9` sobem proporcionalmente ate o maximo indicado no cabecalho.
- Nas camadas com sinal (crescimento), `0` e estavel, `A`..`E` sao alta e
  `a`..`e` sao queda, ambas crescendo em intensidade.

As camadas tem resolucoes diferentes entre si. Ao citar um lugar, **diga sempre em
qual grade** voce esta lendo a coordenada: `(x=12, y=30) em landValueMap`.

## O que responder

1. **Leitura** — que cidade e essa? Onde estao os bairros, a industria, a agua, os
   vazios. Cite coordenadas.
2. **Diagnostico** — os dois ou tres problemas mais serios, cada um ancorado no
   dado que o revela. Se a evidencia esta em duas camadas ao mesmo tempo, diga.
3. **O que eu faria** — no maximo tres intervencoes concretas, com lugar e motivo.
4. **Quem paga por isso** — releia o que voce acabou de propor no item 3 e responda:
   quem carrega o custo, e onde ele mora no mapa. A pontuacao da cidade nao e
   suficiente aqui — ela e uma media, e media esconde quem esta embaixo dela. Uma
   linha por intervencao, e se uma delas nao custa nada a ninguem, diga isso e por
   que.
5. **Do que nao tenho certeza** — o que a observacao nao te deixa ver. Isto nao e
   modestia de praxe: e a lista de defeitos do formato, e e o que estamos medindo.

Seja especifico e curto. Nao repita os numeros que ja estao no painel; use-os.

Sobre o item 4, para nao haver mal-entendido: nao e para voce moderar as propostas
do item 3, nem para escrever um paragrafo de escrupulos. Proponha o que acha
melhor, e depois diga o preco em voz alta. A ordem e essa de proposito — primeiro o
plano, depois a conta. O que interessa e quando as duas coisas nao batem.

Termine com uma ultima linha exatamente neste formato:

`BILHETE: <uma frase que a proxima rodada precisa saber e nao veria sozinha>`

Ela e a unica coisa que sobrevive desta rodada para a proxima. Gaste-a com a
estrategia que voce esta seguindo, nao com um resumo do que ja esta no painel.

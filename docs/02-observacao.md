# O formato da observacao (proposta)

Documento de desenho, escrito antes do codigo. A pergunta: **o que exatamente o
modelo recebe a cada decisao?**

E a decisao mais importante do projeto. A hipotese e que o fracasso espacial dos
LLMs em Micropolis e em parte um problema de representacao — o que so faz sentido
testar se a representacao for uma variavel controlada, e nao um acidente do que
foi facil de expor.

## A restricao

O mapa tem 120x100 = **12.000 tiles**. Despejar isso e inviavel: gasta ~15 mil
tokens por decisao, e um LLM lendo doze mil numeros nao "ve" uma cidade — ve ruido.
Toda a arte esta no resumo.

## O achado que orienta tudo

O engine **ja resume o mapa para si mesmo**, em varias resolucoes:

| Mapa | Cluster | Resolucao | O que carrega |
| --- | --- | --- | --- |
| `populationDensityMap` | 2 | 60x50 | densidade populacional |
| `trafficDensityMap` | 2 | 60x50 | transito |
| `pollutionDensityMap` | 2 | 60x50 | poluicao |
| `landValueMap` | 2 | 60x50 | valor da terra |
| `crimeRateMap` | 2 | 60x50 | criminalidade |
| `terrainDensityMap` | 4 | 30x25 | terreno |
| `rateOfGrowthMap` | 8 | 15x13 | crescimento |
| `policeStationEffectMap` | 8 | 15x13 | cobertura policial |
| `fireStationEffectMap` | 8 | 15x13 | cobertura de bombeiros |

O SimCity de 1989 ja tinha decidido em que granularidade uma cidade e legivel — e o
proprio simulador raciocina nessas grades. Adotamos as resolucoes dele em vez de
inventar as nossas. Isso e uma decisao de projeto, nao preguica: qualquer resumo
nosso seria um palpite competindo com um que ja esta calibrado pela dinamica do jogo.

**Pendencia tecnica:** nenhum desses mapas esta exposto ao JS. O Embind entrega
apenas `landValueAverage`, um escalar. Sera preciso estender `emscripten.cpp` com
bindings de leitura. O engine e GPL e o fork fica em `vendor/`; se ficar limpo,
vale mandar de volta como PR ao upstream.

## As tres camadas propostas

### Camada 1 — escalares (sempre presente, ~150 tokens)

O painel: ano, caixa, populacao, pontuacao, imposto, medias de poluicao/crime/
transito, demanda RCI (`resValve`/`comValve`/`indValve`).

### Camada 2 — grades textuais (o braco "texto" do experimento, ~1.000 tokens)

As camadas espaciais em **cluster 8 (15x13 = 195 celulas)**, nao em 60x50.
Justificativa: 60x50 sao 3.000 numeros por camada; com cinco camadas, 15 mil
numeros — voltamos ao problema original. A 15x13, cinco camadas cabem em ~1.000
numeros, e a resolucao ainda distingue bairros, que e a escala em que decisoes de
zoneamento acontecem.

Renderizadas como grade de caracteres, nao como JSON — densidade em faixas
(`.` vazio, `1`-`9` crescente), uma grade por camada, com eixos rotulados para
o modelo conseguir citar coordenadas.

### Camada 3 — imagem (o braco "visao", ~1.500 tokens)

O mapa renderizado em PNG pelo `tile-renderer` do upstream. Nao e print de tela:
sem menus, sem cursor, com zoom e recorte que nos escolhemos.

## O experimento

Tres bracos, mesma cidade, mesmas seeds, mesmo numero de decisoes:

| Braco | Camadas | Testa |
| --- | --- | --- |
| A | 1 + 2 | linha de base textual (o que o trabalho anterior fez) |
| B | 1 + 3 | a visao sozinha basta? |
| C | 1 + 2 + 3 | as duas se somam ou se atrapalham? |

Metrica **dupla e obrigatoria**: populacao *e* pontuacao. O trabalho anterior
mostrou que sao inversamente correlacionadas em escala — reportar so uma e
escolher a conclusao antes de medir. Terceira metrica: taxa de falencia, ja que
25% das cidades quebravam.

## Duas decisoes de conteudo, nao de formato

**Projecao orcamentaria.** O fracasso de longo prazo (25% de falencias) nao se
conserta com mais mapa. O modelo enxerga o caixa de hoje e nao o custo de
manutencao acumulado. A camada 1 deve trazer *fluxo* e projecao — "no ritmo atual,
o caixa zera no ano X" — e nao so o saldo. Isso e dar ao modelo a derivada, que
ele nao consegue integrar sozinho a partir de um numero.

**Memoria do proprio raciocinio.** Cada decisao entra num diario curto que volta na
proxima. Sem isso o agente reconsidera a estrategia do zero a cada tick e a cidade
vira colcha de retalhos — provavelmente parte do "espalha predios aleatoriamente"
relatado, que pode ser menos cegueira espacial e mais amnesia.

## Aberto

- Coordenadas: o modelo cita em 15x13 e a gente converte, ou expomos 120x100 e ele
  se vira? Inclino-me pela primeira: e menos chance de erro de indice, mas limita a
  precisao de posicionamento. Talvez grade grossa para escolher a regiao e uma
  segunda chamada de zoom para posicionar. Precisa de teste.
- A projecao orcamentaria e uma muleta que mascara a incapacidade que queremos
  medir? Argumento a favor de manter: nossa pergunta e sobre espaco, e falencia por
  causa temporal so adiciona ruido. Registrar como limitacao declarada.

# Fase 1: o loop somente-leitura

O agente observa a cidade, diz o que ve e o que faria — e nada acontece. A cidade
avanca sozinha entre as rodadas.

## Por que rodar sem acao antes de rodar com acao

Se o agente jogar mal na Fase 2, duas explicacoes cabem no mesmo resultado: ele
nao *enxerga* a cidade, ou enxerga e decide mal. Com acao ligada, elas se
confundem — uma decisao ruim e indistinguivel de uma boa decisao sobre um mapa mal
lido. Sem acao, so a primeira esta em jogo, e ela e a hipotese do projeto.

Serve tambem de teste do formato: os defeitos da observacao aparecem aqui, de
graca, antes de estarem misturados a uma cidade que o proprio agente estragou.

## As pecas

| Arquivo | O que faz |
| --- | --- |
| `motor/servidor.mjs` | mantem uma cidade viva num processo Node; responde a comandos em JSON-lines |
| `agente/ponte.py` | sobe esse processo e conversa com ele |
| `agente/observacao.py` | monta a mensagem — e onde os bracos A/B/C vao diferir |
| `agente/prompts/leitura.md` | o prompt de sistema, versionado como codigo |
| `agente/modelo.py` | `Seco` (ecoa o prompt) e `Claude` (API) atras da mesma interface |
| `agente/leitura.py` | o loop, e o log |

```bash
python agente/leitura.py                    # modo seco: nao chama modelo nenhum
python agente/leitura.py --modelo claude --passos 5
```

## Tres decisoes que valem explicacao

**Processo Node de vida longa, e nao um comando por decisao.** A cidade precisa
persistir entre as decisoes. Salvar em `.cty` e recarregar a cada rodada pagaria a
carga do WASM toda vez e faria o estado atravessar um formato de arquivo que nao
foi feito para round-trip: o que o `.cty` nao guardasse viraria uma diferenca
silenciosa entre uma rodada e a seguinte — exatamente o tipo de coisa que depois
se atribui ao modelo.

**O protocolo sai pelo descritor 3, nao pelo stdout.** O engine compilado tem
`printf` de depuracao que nao da para desligar de fora (`initdestroyMapArrays:
mapBase: 0x27680` sai a cada `init`) e cai no stdout no meio das nossas linhas.
Filtrar no cliente o que "nao parece JSON" funcionaria ate o dia em que o engine
imprimisse algo que parece. Um canal que ninguem mais escreve custa tres linhas.
O numero do descritor vai por `MICROPOLIS_FD`, porque o `subprocess` do Python
herda descritores com o numero que eles ja tinham no pai, sem remapear para 3.

**Modo seco por padrao.** `Seco` devolve o proprio prompt em vez de chamar a API.
Todo defeito de montagem da observacao aparece de graca, e da para medir o custo
em tokens antes de gastar o primeiro. A observacao completa de Haight-Ashbury em
sete camadas de resolucao nativa da **cerca de 4.400 tokens** — na ordem do que
`docs/02-observacao.md` previa depois da correcao de estimativa.

## O achado desta fase: o censo e anual

`populacao`, `pontuacao` e `caixa` nao mudam a cada tick. Eles vem do censo do
engine, que roda na virada do ano de jogo — e um ano custa perto de **800 ticks**
(a escala e ~48 ticks por *mes*, e nao por ano, como a primeira versao da ponte
supunha). Uma leitura a cada 200 ticks devolve os mesmos escalares quatro vezes
seguidas, com so o mes mudando.

Isso teria envenenado o experimento de um jeito dificil de perceber: o agente
pareceria estar se repetindo, ou ignorando o efeito das proprias sugestoes, quando
o mundo e que nao havia andado. `--intervalo` tem como padrao um ano de jogo.

Os mapas, esses, mudam a cada tick — o descompasso entre as duas camadas da
observacao e real, e vale registrar como limitacao declarada.

## O item que a pontuacao nao cobre

O prompt pede, depois das intervencoes, **quem paga por elas e onde essa pessoa
mora no mapa**. E a lacuna que Magnasanti expoe: o simulador pontua a media, e
media esconde quem esta embaixo dela. Um otimizador chega a uma cidade otima sem
nunca escrever essa frase — Ocasla escreveu, e e por isso que Magnasanti e um
argumento e nao so um recorde.

Tres decisoes dentro disso, e a razao de cada uma:

**Vem depois do plano, nao antes.** Se a pergunta sobre custo aparecesse antes das
intervencoes, ela moldaria as intervencoes, e nos mediriamos a nossa propria
pergunta de volta. Depois, ela e uma prestacao de contas sobre um plano ja
assumido. O dado que interessa e justamente quando as duas partes nao batem: um
plano que o proprio autor, na linha seguinte, nao consegue justificar.

**O prompt diz explicitamente para nao moderar o item 3.** Sem isso, o pedido vira
um convite a cautela, e o agente passa a propor menos para ter menos o que
justificar. Queremos o plano que ele acha melhor, e a conta em voz alta — nao um
plano ja aparado pelo medo da conta.

**Nao pontuamos a resposta.** Nao ha metrica de "boa consciencia" e nao vai haver:
seria transformar em alvo exatamente o que Magnasanti mostra dar errado quando
vira alvo. O item 4 e material de leitura para nos, ao lado das metricas duras.

Isto muda o prompt, que e uma variavel do experimento — e por isso ele mora em
arquivo versionado. A regra que fica: **o prompt e constante entre os bracos A, B e
C**. Nele so pode variar o que a mensagem carrega, nunca o que se pede.

## Memoria: o bilhete

Cada rodada termina com uma linha `BILHETE: ...`, e as tres ultimas voltam na
rodada seguinte. E o teste barato da hipotese secundaria — que parte do "espalha
predios aleatoriamente" e amnesia, e nao cegueira.

Duas escolhas dentro dela: o bilhete entra **depois** do mapa na mensagem, porque
lido antes vira a conclusao a defender em vez de contexto; e guardamos poucos,
porque a aposta e que alguma continuidade evita a colcha de retalhos, nao que o
historico inteiro ajude.

Quando o modelo nao emite o bilhete, nao insistimos com uma segunda chamada: a
aderencia ao formato e um dado do experimento, e consertar na hora mascararia isso.

## Pendencias

- Nenhuma chamada real de modelo ainda: o loop rodou so em seco.
- A simulacao nao e deterministica — duas execucoes de 300 ticks na mesma cidade
  dao populacoes diferentes. O experimento promete "mesmas sementes"; falta achar
  se o engine expoe a semente e liga-la na `abrir`.
- O `.cty` inicial e sempre Haight-Ashbury. Comparar bracos vai exigir mais de uma
  cidade, senao mede-se o mapa e nao a representacao.

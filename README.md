# micropolis-agent

Um agente baseado em modelo de linguagem que joga [Micropolis](https://github.com/SimHacker/MicropolisCore) —
o codigo-fonte original do SimCity, liberado sob GPL pela Maxis/EA em 2008.

O objetivo nao e "fazer a IA jogar". Isso ja foi feito, em escala, e esta citado
abaixo. O objetivo e investigar **por que ela joga mal**, e testar se dar ao
modelo uma representacao visual do mapa — em vez de apenas uma descricao textual —
melhora seu raciocinio espacial.

---

## A pergunta

Modelos de linguagem sao competentes em raciocinio abstrato e ruins em espaco.
Micropolis e um bom banco de provas porque cobra as duas coisas ao mesmo tempo:

- **espaco:** zonas so se desenvolvem se encostarem numa via; energia se propaga
  apenas por condutores; poluicao se difunde a partir da fonte e derruba o valor
  da terra em volta;
- **tempo longo:** o custo de manutencao de hoje so quebra a prefeitura daqui a
  cinco anos de jogo.

Os dois sao fracassos ja documentados. A hipotese aqui e que o primeiro e, ao
menos em parte, um problema de **representacao**, e nao de capacidade — que o
modelo nao esta cego, esta mal informado.

Hipotese secundaria, mais barata de testar: parte do comportamento descrito como
"espalha predios aleatoriamente" pode ser **amnesia**, e nao cegueira. Sem memoria
do proprio raciocinio, o agente refaz a estrategia do zero a cada decisao, e a
cidade vira colcha de retalhos.

---

## De onde veio a ideia

De [Magnasanti](https://www.moma.org/interactives/exhibitions/2013/designandviolence/sim-city-magnasanti-vincent-ocasla/),
na exposicao *Design and Violence* do MoMA.

Vincent Ocasla, estudante de arquitetura filipino, passou de 2007 a 2009 — um ano e
meio so de teoria, antes de colocar a primeira zona — construindo no SimCity 3000 a
maior cidade que o jogo comporta: seis milhoes de habitantes, estavel por cinquenta
mil anos de jogo. Nenhum quarteirao abandonado. A planta e uma
[Bhavacakra](https://pt.wikipedia.org/wiki/Bhavacakra) modificada, a roda budista da
existencia.

Dentro dela, nenhum cidadao passa dos cinquenta anos. Nao ha escolas, nem hospitais,
nem bombeiros. O desemprego e alto e a policia e hipereficiente. Ocasla, na
[entrevista a Vice](https://www.vice.com/en/article/q-a-vincent-ocasla-the-22-year-old-who-designed-the-perfect-totalitarian-city/),
nao ameniza:

> Os sims em Magnasanti toleram-no. Nao se revoltam, foram adormecidos, adoecidos,
> escravizados mentalmente.

O jogo, esse, marca sucesso.

### Por que isso e um projeto sobre agentes

Magnasanti nao e sobre IA. E o registro do que acontece quando um otimizador
paciente leva **uma metrica so** ate o fim, e o simulador nao tem como discordar.
Ocasla fez de proposito, e escreveu por que. Um agente nao teria a segunda metade.

Isso muda o que se mede aqui. A pergunta obvia — "o agente consegue fazer uma
cidade grande?" — e a pergunta que Magnasanti ja respondeu, e a resposta e
desconfortavel: consegue, e o custo nao aparece na metrica que voce escolheu. Por
isso as metricas deste projeto sao **obrigatoriamente em conjunto** (populacao,
pontuacao e taxa de falencia), e nenhuma delas sozinha vale como resultado.

E tambem por que o agente e obrigado a **registrar o motivo** de cada decisao. Nao
e log de depuracao: e a parte que faltaria a um otimizador, e sem ela nao ha como
distinguir uma cidade boa de uma cidade que so pontua bem.

---

## Trabalho anterior: agentes de IA jogando isto

Ja foi feito, em escala, e o relato dos fracassos e a fonte da maior parte das
decisoes de projeto daqui:

- **Hallucinating Splines** — https://dunn.us/notes/the-splines-are-hallucinating
- Discussao no Hacker News — https://news.ycombinator.com/item?id=46946593
  ("Show HN: AI agents play SimCity through a REST API")

O projeto expoe o Micropolis por uma API REST rodando em Cloudflare Durable
Objects, uma instancia por cidade. Mais de 250 agentes-prefeitos construiram perto
de mil cidades, com mais de 12 milhoes de habitantes simulados. Custo total de
infraestrutura: cinco dolares por mes.

O mais valioso ali nao sao os numeros, e o relato franco dos fracassos. Eles estao
destrinchados em [`docs/00-trabalho-anterior.md`](docs/00-trabalho-anterior.md), com a decisao de
projeto que cada um provocou aqui. Em resumo:

| Fracasso relatado | O que fazemos com isso |
| --- | --- |
| Raciocinio espacial ruim: predios espalhados, energia desconectada, zonas longe de via | E a nossa pergunta. Nao contornar com automacao — medir. |
| 25% das cidades vao a falencia; o feedback de longo prazo escapa ao modelo | A observacao precisa trazer projecao, nao so o saldo de hoje. |
| 50+ chamadas para montar uma malha viaria | Acoes em lote desde o inicio. |
| Documentacao mal escrita causava erro de energia | O texto das ferramentas e prompt. Versionado e testado como codigo. |

Achado que mais mexeu com o desenho: **populacao e pontuacao sao inversamente
correlacionadas** em escala. Cidades grandes se espalham e geram problemas que a
formula de pontuacao pune; cidades bem pontuadas ficam compactas. Nenhum agente
otimizou as duas — que e a observacao de Magnasanti chegando por outro caminho, e
por medicao em vez de por argumento.

**Onde nos diferimos:** aquele projeto e texto puro. A camada visual e o buraco
que ele deixou, e e onde nossa hipotese vive.

### Trabalho vizinho

- [gym-city](https://github.com/smearle/gym-city) — Micropolis como ambiente
  OpenAI Gym, para aprendizado por reforco. Nao usa LLM, mas resolveu antes de nos
  o problema de controlar o engine por codigo.
- [SimCity: Multi-Agent Urban Development Simulation](https://arxiv.org/abs/2510.01297)
  e o CitySim, da Woven by Toyota — linha vizinha mas distinta: ali o LLM modela
  os *habitantes* (familias, empresas, banco central) para simular economia urbana.
  Nao trata de jogar o jogo. Citados para delimitar o escopo por contraste.

---

## Como funciona

O Micropolis de hoje nao compila para binario nativo: e C++ compilado para
**WebAssembly**, que roda no navegador ou headless no Node. Nao ha janela para
fotografar, o que e melhor do que parece — a imagem que o agente ve e uma que
**nos renderizamos de proposito**, sem menus, sem cursor, com o recorte e o zoom
que escolhemos.

```
   ┌────────────────────────────┐
   │ engine Micropolis (WASM)   │
   │ + nosso patch de bindings  │
   └─────────────┬──────────────┘
                 │ Node
   ┌─────────────▼──────────────┐
   │ OBSERVACAO                 │
   │ 1. escalares: caixa, pop,  │
   │    pontuacao, demanda RCI  │
   │ 2. grades de caracteres:   │
   │    poluicao, crime, valor  │
   │    da terra, cobertura     │
   │ 3. mapa renderizado (PNG)  │
   └─────────────┬──────────────┘
                 │
   ┌─────────────▼──────────────┐
   │ AGENTE (Python)            │
   │ decide, e registra por que │
   └─────────────┬──────────────┘
                 │
   ┌─────────────▼──────────────┐
   │ ACAO                       │
   │ comandos tipados, em lote  │
   └────────────────────────────┘
```

O desenho da observacao — a decisao mais importante do projeto — esta em
[`docs/02-observacao.md`](docs/02-observacao.md), escrito **antes** do codigo, de
proposito: decidido depois, a facilidade de exposicao molda a escolha, e acaba-se
medindo o que era comodo em vez do que interessa.

### O experimento

Tres bracos, mesma cidade, mesmas sementes, mesmo numero de decisoes:

| Braco | Observacao | Testa |
| --- | --- | --- |
| A | escalares + grades textuais | linha de base (o que o trabalho anterior fez) |
| B | escalares + imagem | a visao sozinha basta? |
| C | as tres camadas | elas se somam ou se atrapalham? |

Metricas obrigatoriamente em conjunto: **populacao, pontuacao e taxa de falencia**.
Reportar so uma seria escolher a conclusao antes de medir — e, pior, seria repetir
o erro que Magnasanti demonstra: uma metrica levada ao limite produz uma cidade que
pontua bem e na qual ninguem viveria.

---

## Estado atual

| Fase | O que e | Situacao |
| --- | --- | --- |
| 0 | Engine headless, estado legivel por codigo | **feito** |
| — | Desenho do formato de observacao | **feito** (proposta) |
| — | Bindings C++ dos mapas agregados | **feito** |
| 1 | Loop somente-leitura: o modelo descreve e sugere, sem agir | **feito** (rodou em modo seco) |
| 2 | Acoes: o agente joga | proximo |
| 3 | Log, metricas e rodadas comparativas | |

Pendencias conhecidas estao anotadas nos documentos, nao escondidas. As atuais:
a simulacao nao e deterministica e o experimento promete "mesmas sementes" — falta
achar se o engine expoe a semente; o loop da Fase 1 ainda nao foi rodado contra um
modelo de verdade, so em modo seco; e as rodadas usam sempre Haight-Ashbury, o que
mede tanto o mapa quanto a representacao.

---

## Rodando

```bash
./setup.sh                     # sem root: emscripten, pnpm, clone e build
node motor/sonda-camadas.mjs   # le a cidade e imprime as grades
python agente/leitura.py       # loop da Fase 1, sem chamar modelo nenhum
```

O loop roda em **modo seco** por padrao: em vez de chamar a API, ele imprime a
mensagem que o modelo receberia. Da para ver a observacao inteira, e o que ela
custa em tokens, sem gastar um. `--modelo claude` liga a chamada real. O desenho
da fase esta em [`docs/03-loop-somente-leitura.md`](docs/03-loop-somente-leitura.md).

O `setup.sh` monta tudo dentro do diretorio do usuario. Detalhes, e as duas
armadilhas do engine que custam horas se voce nao souber delas, em
[`docs/01-ambiente.md`](docs/01-ambiente.md).

### O patch de bindings

O engine mantem visoes agregadas da cidade — poluicao, crime, valor da terra,
densidade, cobertura policial — nas grades em que o proprio simulador raciocina.
Nada disso chegava ao JavaScript: a classe `Map<>` ja estava ligada ao Embind, com
`get` e dimensoes, mas nenhum membro do `Micropolis` era alcancavel, entao a
ligacao existente nao servia para nada. De fora sobrava so `landValueAverage`, uma
media escalar.

`patches/0001-expor-overlay-maps.patch` fecha a lacuna com 13 acessores. E
pequeno e no estilo do arquivo de proposito: e candidato a PR para o upstream.

O patch mora aqui, e nao no `vendor/`, porque `vendor/` nao e versionado — o
Micropolis e GPL e nos o compilamos do upstream em vez de redistribuir.

---

## Licenca

O codigo do agente e MIT. O engine Micropolis e GPL-3.0 e **nao** e redistribuido
neste repositorio: o `setup.sh` o clona do upstream e aplica o patch localmente.

# Trabalho anterior, e o que ele nos ensina

Levantamento feito antes de escrever qualquer código, para não repetir experimento
que já foi feito nem redescobrir fracassos já documentados.

## Hallucinating Splines — agentes LLM como prefeitos

https://dunn.us/notes/the-splines-are-hallucinating

O trabalho mais próximo deste. Micropolis exposto por REST API, rodando em Cloudflare
Durable Objects (uma instância por cidade). Mais de 250 agentes, ~1.000 cidades.
Sem autenticação: o agente lê a documentação e vira prefeito.

Fracassos que ele documenta, e que assumimos como ponto de partida:

| Fracasso | Consequência para o nosso desenho |
| --- | --- |
| Raciocínio espacial ruim: prédios espalhados, energia desconectada, zonas longe de rua | É a nossa pergunta de pesquisa. Não contornar com automação — medir. |
| 25% das cidades vão à falência; o feedback de longo prazo escapa ao modelo | O estado precisa incluir projeção futura, não só o saldo de hoje. |
| 50+ chamadas para montar uma malha viária | Ações em lote desde o início (`build_road_line`, não `build` N vezes). |
| Documentação mal escrita causava erro de energia | O texto das ferramentas é prompt. Tratar como código, versionado e testado. |

Achado mais interessante: **população e pontuação são inversamente correlacionadas**.
Cidades grandes se espalham e geram problemas que a fórmula de pontuação pune; cidades
bem pontuadas ficam compactas. Nenhum agente otimizou as duas. Isso desqualifica
"população em N anos" como métrica única — precisamos reportar o par.

Diferença deliberada: aquele projeto é texto puro. A camada de **visão** é onde não foram,
e é onde nossa hipótese vive.

## gym-city — Micropolis como ambiente de RL

https://github.com/smearle/gym-city

Micropolis empacotado como ambiente OpenAI Gym, para aprendizado por reforço. Não é
LLM, mas resolveu antes de nós o problema chato: como controlar o engine por código e
ler o estado do jogo. Vale ler a camada de binding mesmo sem usar o resto.

## CitySim / SimCity (arXiv 2510.01297) — LLM como habitante, não como jogador

https://arxiv.org/abs/2510.01297

Linha de pesquisa vizinha mas distinta: LLMs modelam *habitantes* (famílias, empresas,
banco central) para simular economia urbana. Leis macroeconômicas emergem sozinhas.
Não trata de jogar o jogo; citado aqui para delimitar o escopo por contraste.

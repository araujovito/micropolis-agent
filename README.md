# micropolis-agent

Um agente baseado em LLM que joga [Micropolis](https://github.com/SimHacker/MicropolisCore)
— o código-fonte original do SimCity 1, liberado sob GPL pela Maxis/EA.

O objetivo não é "fazer a IA jogar". Isso já foi feito. O objetivo é investigar **por que
ela joga mal**, e se dar ao modelo uma representação visual do mapa — e não apenas
uma descrição textual — melhora seu raciocínio espacial.

## A pergunta

Modelos de linguagem são competentes em raciocínio abstrato e ruins em espaço. Micropolis
é um bom banco de provas porque exige as duas coisas ao mesmo tempo:

- **espaço:** zonas precisam encostar em ruas; energia se propaga por condutores; poluição
  se difunde a partir da fonte;
- **tempo longo:** o custo de manutenção de hoje só quebra a prefeitura daqui a cinco anos.

Ambos são fracassos documentados (ver `docs/00-prior-art.md`). A hipótese aqui é que o
primeiro é, em parte, um problema de *representação*, não de capacidade.

## Estado

Fase 0 — montando o ambiente. Nada funcional ainda.

## Licença

O agente é MIT. O engine Micropolis é GPL e não é redistribuído aqui: ele é compilado
a partir do upstream durante a instalação.

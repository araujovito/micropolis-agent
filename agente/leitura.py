"""Fase 1: o loop somente-leitura.

O agente observa a cidade, descreve o que ve e diz o que faria — e nada acontece.
A cidade avanca sozinha entre as rodadas.

Rodar sem acao antes de rodar com acao e o que separa duas perguntas que, juntas,
nao teriam resposta: se o agente joga mal porque nao *enxerga* a cidade, ou porque
enxerga e decide mal. Aqui so a primeira esta em jogo, e ela e a nossa hipotese.

    python agente/leitura.py                      # modo seco, nao chama modelo
    python agente/leitura.py --modelo claude      # chama a API de verdade
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

import observacao
from modelo import Claude, Seco
from ponte import TICKS_POR_ANO, Motor

RAIZ = Path(__file__).resolve().parent.parent
EXECUCOES = RAIZ / "execucoes"

# O bilhete e a memoria entre rodadas. Guardamos poucos: a hipotese e que alguma
# continuidade evita a colcha de retalhos, nao que o historico inteiro ajude —
# um diario longo empurra o modelo a defender o que ja disse.
BILHETES_LEMBRADOS = 3


def extrair_bilhete(resposta: str) -> str | None:
    """A ultima linha `BILHETE: ...` da resposta, se houver.

    Nao insistimos quando ela falta: a aderencia ao formato e um dado do
    experimento, e forcar uma segunda chamada para consertar mascararia isso.
    """
    for linha in reversed(resposta.strip().splitlines()):
        if linha.strip().startswith("BILHETE:"):
            return linha.split(":", 1)[1].strip()
    return None


def rodar(cidade: str, aquecimento: int, passos: int, intervalo: int, modelo) -> Path:
    inicio = dt.datetime.now()
    destino = EXECUCOES / f"{inicio:%Y%m%d-%H%M%S}-leitura-{modelo.nome}.jsonl"
    destino.parent.mkdir(exist_ok=True)

    sistema = observacao.sistema()
    diario: list[str] = []

    with Motor(cidade) as motor, destino.open("w", encoding="utf-8") as log:
        # Uma cidade recem-carregada esta parada — populacao zero, mapas vazios —
        # e o aquecimento a deixa no regime em que ela de fato vive. Sem isso o
        # agente descreveria uma fotografia de transicao, e nos mediriamos isso.
        motor.avancar(aquecimento)

        for passo in range(1, passos + 1):
            if passo > 1:
                motor.avancar(intervalo)
            obs = motor.observar()
            mensagem = observacao.mensagem(obs, diario=diario)
            resposta = modelo.responder(sistema, mensagem)

            bilhete = extrair_bilhete(resposta)
            if bilhete:
                diario = [*diario, bilhete][-BILHETES_LEMBRADOS:]

            # Uma linha por rodada, com a mensagem inteira: sem ela, uma resposta
            # ruim daqui a um mes nao tem como ser reproduzida nem explicada.
            log.write(
                json.dumps(
                    {
                        "passo": passo,
                        "ticks": obs["ticks"],
                        "modelo": modelo.nome,
                        "escalares": obs["escalares"],
                        "mensagem": mensagem,
                        "resposta": resposta,
                        "bilhete": bilhete,
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
            log.flush()  # o log serve durante a rodada, nao so depois dela

            e = obs["escalares"]
            print(f"— passo {passo}/{passos} · ano {e['ano']} · pop {e['populacao']:,} "
                  f"· pontuacao {e['pontuacao']} · bilhete: {bilhete or '(nenhum)'}")

    return destino


def main() -> None:
    p = argparse.ArgumentParser(description="Fase 1: loop somente-leitura.")
    p.add_argument("--cidade", default="/cities/haight.cty")
    p.add_argument("--aquecimento", type=int, default=TICKS_POR_ANO,
                   help="ticks antes da primeira leitura")
    p.add_argument("--passos", type=int, default=3, help="quantas leituras")
    p.add_argument("--intervalo", type=int, default=TICKS_POR_ANO,
                   help="ticks entre leituras; abaixo de um ano os escalares se repetem")
    p.add_argument("--modelo", default="seco", choices=["seco", "claude"])
    args = p.parse_args()

    modelo = Seco() if args.modelo == "seco" else Claude()
    destino = rodar(args.cidade, args.aquecimento, args.passos, args.intervalo, modelo)
    print(f"\nlog em {destino.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()

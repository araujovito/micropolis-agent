"""Ponte entre o agente (Python) e o engine Micropolis (Node/WASM).

O engine so existe compilado para WebAssembly, e o carregador dele e um modulo
JavaScript — nao ha binario nativo para amarrar por FFI. Entao o Node roda como
subprocesso de vida longa (`motor/servidor.mjs`) e conversamos por JSON-lines.

Um pedido, uma resposta, na ordem: o servidor e sequencial e o agente tambem.
Nao ha fila nem `id` correlacionando fora de ordem — o `id` viaja so para que uma
resposta trocada apareca como erro alto em vez de dado silenciosamente errado.
"""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path
from typing import Any

RAIZ = Path(__file__).resolve().parent.parent
SERVIDOR = RAIZ / "motor" / "servidor.mjs"

# Medido, nao lido da documentacao: 800 ticks avancam o relogio do engine em um
# ano de jogo em Haight-Ashbury. E o intervalo minimo util entre duas leituras.
TICKS_POR_ANO = 800


class ErroDoMotor(RuntimeError):
    """O servidor respondeu, mas recusou o comando."""


class Motor:
    """Uma cidade viva num processo Node. Use como gerenciador de contexto."""

    def __init__(self, cidade: str = "/cities/haight.cty") -> None:
        self.cidade = cidade
        self._proc: subprocess.Popen | None = None
        self._respostas = None
        self._id = 0

    def __enter__(self) -> "Motor":
        # O protocolo trafega no descritor 3, e nao no stdout, porque o engine
        # compilado imprime depuracao propria no stdout e sujaria as linhas.
        ler, escrever = os.pipe()
        # `pass_fds` preserva o numero do descritor, sem remapear para 3; em vez
        # de um `preexec_fn` so para dar o dup2, dizemos ao servidor qual numero
        # usar.
        self._proc = subprocess.Popen(
            ["node", str(SERVIDOR)],
            env={**os.environ, "MICROPOLIS_FD": str(escrever)},
            stdin=subprocess.PIPE,
            # O barulho do engine vai para o stderr do agente, onde da para ver
            # durante a depuracao sem atrapalhar o protocolo.
            stdout=subprocess.DEVNULL,
            pass_fds=(escrever,),
            text=True,
            cwd=RAIZ,
        )
        os.close(escrever)  # a ponta de escrita agora e do filho; se nos a
        # mantivessemos aberta, a leitura nunca veria EOF quando ele morresse.
        self._respostas = os.fdopen(ler, "r")
        self.abrir(self.cidade)
        return self

    def __exit__(self, *_) -> None:
        if self._proc and self._proc.poll() is None:
            try:
                self._pedir("encerrar")
            except (ErroDoMotor, BrokenPipeError, OSError):
                pass
            self._proc.wait(timeout=5)
        if self._respostas:
            self._respostas.close()

    def _pedir(self, cmd: str, **args: Any) -> dict:
        assert self._proc and self._proc.stdin and self._respostas
        self._id += 1
        self._proc.stdin.write(json.dumps({"cmd": cmd, "id": self._id, **args}) + "\n")
        self._proc.stdin.flush()
        linha = self._respostas.readline()
        if not linha:
            raise ErroDoMotor(f"o servidor morreu sem responder a '{cmd}'")
        resposta = json.loads(linha)
        if resposta.get("id") != self._id:
            raise ErroDoMotor(
                f"resposta fora de ordem: esperava id {self._id}, veio {resposta.get('id')}"
            )
        if not resposta.get("ok"):
            raise ErroDoMotor(resposta.get("erro", "erro sem mensagem"))
        return resposta

    def abrir(self, cidade: str) -> dict:
        return self._pedir("abrir", cidade=cidade)

    def avancar(self, n: int = 1) -> dict:
        """Avanca n ticks.

        A escala e ~48 ticks por *mes*, nao por ano: um ano de jogo custa perto de
        `TICKS_POR_ANO`. Isso importa porque populacao, pontuacao e caixa vem do
        censo, que so roda na virada do ano — pedir uma observacao a cada 100
        ticks devolve os mesmos escalares quatro vezes seguidas, com so o mes
        mudando. O mapa, esse, muda a cada tick.
        """
        return self._pedir("avancar", n=n)

    def observar(self) -> dict:
        """A observacao completa: `escalares` (camada 1) e `grades` (camada 2)."""
        return self._pedir("observar")


if __name__ == "__main__":  # sonda manual da ponte
    with Motor() as motor:
        motor.avancar(300)
        obs = motor.observar()
        print(json.dumps(obs["escalares"], indent=1, ensure_ascii=False))
        print(obs["grades"]["landValueMap"])

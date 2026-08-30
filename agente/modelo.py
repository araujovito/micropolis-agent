"""Os clientes de modelo, atras de uma interface unica.

Duas implementacoes: `Seco` nao chama ninguem e devolve o proprio prompt, e
`Claude` fala com a API. A Fase 1 roda em seco por padrao — da para inspecionar
exatamente o que o agente veria, e conferir o custo em tokens, sem gastar um
unico.
"""

from __future__ import annotations

from typing import Protocol


class Modelo(Protocol):
    nome: str

    def responder(self, sistema: str, mensagem: str) -> str: ...


class Seco:
    """Nao chama modelo nenhum: ecoa o que teria sido enviado.

    Serve de linha de base de inspecao — todo defeito de prompt que aparece aqui
    aparece de graca.
    """

    nome = "seco"

    def responder(self, sistema: str, mensagem: str) -> str:
        return (
            "[modo seco: nenhum modelo foi chamado]\n\n"
            f"--- sistema ({len(sistema)} caracteres) ---\n{sistema}\n"
            f"--- mensagem ({len(mensagem)} caracteres) ---\n{mensagem}"
        )


class Claude:
    """Cliente da API da Anthropic.

    O `import` mora dentro do construtor de proposito: o modo seco e o caminho
    padrao da Fase 1 e nao deve exigir o pacote instalado nem a chave no ambiente.
    """

    def __init__(self, modelo: str = "claude-opus-5", max_tokens: int = 2000) -> None:
        import anthropic  # noqa: PLC0415

        self.nome = modelo
        self.max_tokens = max_tokens
        self._cliente = anthropic.Anthropic()

    def responder(self, sistema: str, mensagem: str) -> str:
        resposta = self._cliente.messages.create(
            model=self.nome,
            max_tokens=self.max_tokens,
            system=sistema,
            messages=[{"role": "user", "content": mensagem}],
        )
        return "\n".join(b.text for b in resposta.content if b.type == "text")

"""Monta a mensagem que o modelo recebe, a partir da observacao crua do motor.

Fica separada do loop porque e a variavel do experimento: os bracos A, B e C
diferem exatamente aqui, e nada mais. Manter a montagem num lugar so e o que
permite trocar de braco sem tocar no resto.
"""

from __future__ import annotations

from pathlib import Path

PROMPTS = Path(__file__).resolve().parent / "prompts"

# Ordem em que as camadas aparecem na mensagem. Da mais estrutural para a mais
# derivada: quem le comeca pelo desenho da cidade e so depois recebe os sintomas.
ORDEM = [
    "landValueMap",
    "populationDensityMap",
    "pollutionDensityMap",
    "crimeRateMap",
    "trafficDensityMap",
    "rateOfGrowthMap",
    "policeStationEffectMap",
]


def sistema() -> str:
    """O prompt de sistema, lido do arquivo versionado.

    Em arquivo, e nao em literal de codigo, porque o texto do prompt *e* uma das
    variaveis do experimento: precisa aparecer no diff quando muda, e precisa
    poder ser citado por versao num resultado.
    """
    return (PROMPTS / "leitura.md").read_text(encoding="utf-8")


def painel(escalares: dict) -> str:
    """Camada 1 em texto corrido. Curto de proposito: e o que sempre esta la."""
    e = escalares
    d, med = e["demanda"], e["medias"]
    quebra = (
        f"no ritmo atual o caixa zera em {e['anosAteQuebrar']} anos"
        if e["anosAteQuebrar"] is not None
        else "o caixa esta subindo"
    )
    return "\n".join(
        [
            f"Ano {e['ano']}, mes {e['mes']}. {e['classe'].capitalize()}, "
            f"populacao {e['populacao']:,}, pontuacao {e['pontuacao']}.",
            f"Caixa {e['caixa']:,}, fluxo anual {e['fluxoAnual']:+,} ({quebra}). "
            f"Imposto {e['imposto']}%.",
            f"Zonas ocupadas: R {e['residencial']:,} / C {e['comercial']:,} / I {e['industrial']:,}.",
            f"Demanda reprimida: R {d['residencial']:+} / C {d['comercial']:+} / I {d['industrial']:+}.",
            f"Medias: poluicao {med['poluicao']}, crime {med['crime']}, "
            f"valor da terra {med['valorDaTerra']}, transito {med['transito']}.",
        ]
    )


def mensagem(obs: dict, diario: list[str] | None = None, grades: bool = True) -> str:
    """A observacao inteira como uma mensagem de usuario.

    `grades=False` da o braco B (escalares + imagem), quando a camada 3 existir.
    """
    partes = ["# Painel da cidade", "", painel(obs["escalares"])]

    if grades:
        partes += ["", "# Mapa, por camada", ""]
        partes += ["```", "\n\n".join(obs["grades"][n] for n in ORDEM), "```"]

    if diario:
        # A memoria do proprio raciocinio vem *depois* do mapa, e nao antes: lida
        # primeiro, ela viraria a conclusao a defender em vez de contexto.
        partes += [
            "",
            "# O que voce ja disse desta cidade",
            "",
            *(f"- {linha}" for linha in diario),
        ]

    return "\n".join(partes)

# Ambiente: como o engine roda aqui

## O que o Micropolis e hoje

O MicropolisCore nao compila para binario nativo. Ele e C++ compilado para
**WebAssembly** via Emscripten, e roda em navegador ou headless no Node. Nao ha
binding Python publicado, e nao ha pacote no npm — e preciso compilar.

Isso derruba o plano original de capturar a janela do jogo com `mss` e clicar com
o mouse. Nao existe janela. Falamos direto com o motor, o que e melhor: mais rapido,
deterministico, e sem ruido de interface.

## Instalacao (sem root)

Nenhuma dependencia de sistema foi necessaria. Tudo mora no diretorio do usuario:

| Peca | Onde | Como |
| --- | --- | --- |
| Emscripten 6.0.8 | `~/.local/share/emsdk` | `git clone` + `./emsdk install latest` |
| pnpm 10.28 | `~/.local/bin` | `corepack enable --install-directory ~/.local/bin` |
| MicropolisCore | `vendor/` (fora do git) | `git clone --depth 1` |

Build: `source ~/.local/share/emsdk/emsdk_env.sh` e entao `pnpm run build:engine`.

Duas pedras no caminho, ambas do upstream:

- um script interno chama `pnpm` pelo nome, entao nao basta `corepack pnpm`;
- o pacote do engine usa `tsc` para emitir os tipos mas nao o declara como
  dependencia — assume `tsc` global. Contornado emprestando o binario de outro
  pacote do monorepo via PATH, sem alterar o vendor.

## Sequencia de inicializacao (a parte nao obvia)

O engine **exige um callback de frontend registrado antes de `init()`**. Ele nao
e opcional: a primeira notificacao a interface escreve em memoria invalida e
derruba o processo com `memory access out of bounds`. A ordem e:

    setCallback(cb, {}) -> init() -> loadCity(path) -> simTick()

Para uso headless o callback pode ser no-op, mas os 36 metodos precisam existir.
Os nomes estao em `apps/micropolis/src/lib/wasm/callbacks.ts` do upstream.

Segunda pegadinha: o `.data` com as cidades de exemplo e resolvido relativo ao
**diretorio de trabalho**, nao ao do modulo. E preciso entrar no diretorio do build
antes de inicializar.

## Estado exposto

299 simbolos chegam ao JS via Embind. `bridge/probe.mjs` le um subconjunto e
comprova que a simulacao evolui — 500 ticks em Haight-Ashbury levam a populacao
de 0 a ~214 mil, com poluicao e transito subindo junto.

Pendencia: a conversao de `cityTime` para ano esta chutada como `1900 + tick/48`.
Conferir contra o codigo do engine antes de usar em qualquer metrica.

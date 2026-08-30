#!/usr/bin/env bash
# Prepara o ambiente do zero: engine Micropolis compilado e com nossos bindings.
# Nao requer root. Ver docs/01-ambiente.md para o porque de cada passo.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EMSDK="${EMSDK_DIR:-$HOME/.local/share/emsdk}"
VENDOR="$RAIZ/vendor/MicropolisCore"

echo "==> Emscripten"
if [ ! -d "$EMSDK" ]; then
  git clone --depth 1 https://github.com/emscripten-core/emsdk.git "$EMSDK"
fi
(cd "$EMSDK" && ./emsdk install latest && ./emsdk activate latest)
# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1

echo "==> pnpm"
if ! command -v pnpm >/dev/null; then
  COREPACK_ENABLE_DOWNLOAD_PROMPT=0 corepack enable --install-directory "$HOME/.local/bin"
  export PATH="$HOME/.local/bin:$PATH"
fi

echo "==> MicropolisCore (GPL, nao redistribuido: clonado do upstream)"
if [ ! -d "$VENDOR" ]; then
  mkdir -p "$RAIZ/vendor"
  git clone --depth 1 https://github.com/SimHacker/MicropolisCore.git "$VENDOR"
fi

echo "==> Nosso patch de bindings"
cd "$VENDOR"
for p in "$RAIZ"/patches/*.patch; do
  if git apply --check "$p" 2>/dev/null; then
    git apply "$p"
    echo "    aplicado: $(basename "$p")"
  elif git apply --reverse --check "$p" 2>/dev/null; then
    echo "    ja aplicado: $(basename "$p")"
  else
    echo "    ERRO: $(basename "$p") nao aplica nem esta aplicado. O upstream mudou?" >&2
    exit 1
  fi
done

echo "==> Build"
pnpm install --frozen-lockfile
# O pacote do engine usa tsc para emitir tipos mas nao o declara como dependencia:
# emprestamos o binario de outro pacote do monorepo em vez de alterar o vendor.
export PATH="$VENDOR/apps/micropolis/node_modules/.bin:$PATH"
pnpm run build:engine

echo
echo "pronto. teste com:  node motor/sonda-camadas.mjs"

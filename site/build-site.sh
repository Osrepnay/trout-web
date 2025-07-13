#!/bin/sh

set -e

$(wasm32-wasi-ghc-9.10 --print-libdir)/post-link.mjs -i dist/trout-web-exe.wasm -o dist/ghc_wasm_jsffi.js
cp -r node_modules/@lichess-org/chessground/assets dist/
# allow pieces outside of the actual board
sed -e "s/\\.cg-wrap //g" -i dist/assets/chessground.cburnett.css
./node_modules/.bin/esbuild --bundle --format=esm index.js worker.js --outdir=dist

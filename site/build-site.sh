#!/bin/sh

$(wasm32-wasi-ghc-9.10 --print-libdir)/post-link.mjs -i dist/trout-web-exe.wasm -o dist/ghc_wasm_jsffi.js
cp -r node_modules/@lichess-org/chessground/assets dist/
./node_modules/.bin/esbuild --bundle --format=esm index.js --outfile=dist/bundle.js

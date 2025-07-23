#!/bin/sh

set -e

BUILDFLAGS="--with-compiler=wasm32-wasi-ghc-9.10 --with-hc-pkg=wasm32-wasi-ghc-pkg-9.10 --with-hsc2hs=wasm32-wasi-hsc2hs-9.10"

cabal build $BUILDFLAGS
cabal install $BUILDFLAGS --installdir=site/dist --overwrite-policy=always
cd site
cd dist
mv trout-web-exe.wasm trout-big.wasm
wasm-opt trout-big.wasm -Os -o trout-web-exe.wasm
rm trout-big.wasm
cd ..
npm install
npm run build

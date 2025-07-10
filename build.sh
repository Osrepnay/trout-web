#!/bin/sh

BUILDFLAGS="--with-compiler=wasm32-wasi-ghc-9.10 --with-hc-pkg=wasm32-wasi-ghc-pkg-9.10 --with-hsc2hs=wasm32-wasi-hsc2hs-9.10"

cabal build $BUILDFLAGS
cabal install $BUILDFLAGS --installdir=site/dist --overwrite-policy=always
cd site
npm install
npm run build

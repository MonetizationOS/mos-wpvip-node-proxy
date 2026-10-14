#!/usr/bin/env bash
# Rebuilds dist/ from Cloudflare's lol-html JS API with js-api.patch applied, in a pinned
# container. Needs Docker. Usage: vendor/lol-html/build.sh
set -euo pipefail
cd "$(dirname "$0")"

docker run --rm --platform linux/arm64 -v "$PWD:/vendor" -v lol-html-target:/target rust:1.99.0-bookworm bash -euo pipefail -c '
    LOL_HTML=3.0.1
    LOL_HTML_SHA256=76b29b987ede8ea8971edf4a07a0e2edf5a1dfe21a8d2c073f6534d01b2f5c9f
    BINARYEN=133
    BINARYEN_SHA256=89c07ea56faf38d0fbecf36ca8ec0721756716185f265b568e133d427f299bf8

    cd /tmp
    curl -fsSL "https://codeload.github.com/cloudflare/lol-html/tar.gz/refs/tags/v$LOL_HTML" -o lol-html.tgz
    echo "$LOL_HTML_SHA256  lol-html.tgz" | sha256sum -c -
    tar xzf lol-html.tgz
    curl -fsSL "https://github.com/WebAssembly/binaryen/releases/download/version_$BINARYEN/binaryen-version_$BINARYEN-aarch64-linux.tar.gz" -o binaryen.tgz
    echo "$BINARYEN_SHA256  binaryen.tgz" | sha256sum -c -
    tar xzf binaryen.tgz

    rustup target add wasm32-unknown-unknown
    cargo install --quiet --locked wasm-bindgen-cli --version 0.2.120

    cd "/tmp/lol-html-$LOL_HTML"
    patch -p1 < /vendor/js-api.patch
    cd js-api
    CARGO_TARGET_DIR=/target RUSTFLAGS="-C target-feature=+simd128" cargo build --release --locked --target wasm32-unknown-unknown

    rm -rf /vendor/dist
    wasm-bindgen --target nodejs --out-dir /vendor/dist /target/wasm32-unknown-unknown/release/lol_html.wasm
    "/tmp/binaryen-version_$BINARYEN/bin/wasm-opt" -O3 \
        --enable-simd --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
        --enable-reference-types --enable-multivalue --enable-mutable-globals \
        /vendor/dist/lol_html_bg.wasm -o /vendor/dist/lol_html_bg.wasm
    rm -f /vendor/dist/lol_html_bg.wasm.d.ts
    echo "{ \"type\": \"commonjs\" }" > /vendor/dist/package.json
'
ls -l dist

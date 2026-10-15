# lol-html

[lol-html](https://github.com/cloudflare/lol-html) is the streaming HTML rewriter behind Cloudflare's `HTMLRewriter`. `dist/` is its JS API (`js-api/`, v3.0.1) built to WASM for Node, with [`js-api.patch`](js-api.patch) applied:

- **Buffered output.** lol-html emits output a token at a time. The patch collects it in WASM memory and calls the output sink once per `write()` and `end()`, since crossing into JS for each token was most of the cost of a rewrite.
- **`onEndTag` on void elements throws**, as Cloudflare's `HTMLRewriter` does, instead of silently never calling the handler.
- **Release profile**: LTO, one codegen unit, `panic = "abort"` and `simd128`, then `wasm-opt -O3`. The patch also makes `js-api` its own Cargo workspace, so it builds outside lol-html's.

To rebuild `dist/` (needs Docker; the build runs in a linux/arm64 container, emulated on x86 hosts):

```sh
vendor/lol-html/build.sh
```

The script pins the lol-html and binaryen tarballs and the Rust image by SHA-256, and wasm-bindgen by version.

lol-html is BSD-3-Clause licensed; see [LICENSE](LICENSE). The crates compiled into the WASM are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

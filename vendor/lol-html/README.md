# lol-html

[lol-html](https://github.com/cloudflare/lol-html) is the streaming HTML rewriter behind Cloudflare's `HTMLRewriter`. `dist/` is its JS API (`js-api/`, v3.0.1) built to WASM for Node, with [`js-api.patch`](js-api.patch) applied:

- **Buffered output.** lol-html emits output a token at a time. The patch collects it in WASM memory and calls the output sink once per `write()` and `end()`, since crossing into JS for each token was most of the cost of a rewrite.
- **`onEndTag` on void elements throws**, as Cloudflare's `HTMLRewriter` does, instead of silently never calling the handler.
- **Release profile**: LTO, one codegen unit, `simd128`, then `wasm-opt -O3`.

To rebuild `dist/` (needs Docker):

```sh
vendor/lol-html/build.sh
```

The script pins the lol-html and binaryen tarballs by SHA-256, and pins the Rust image and wasm-bindgen versions.

lol-html is BSD-3-Clause licensed; see [LICENSE](LICENSE).

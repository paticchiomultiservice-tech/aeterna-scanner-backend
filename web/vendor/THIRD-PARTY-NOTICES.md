# OCR distributables

Tesseract.js 7.0.0 and Tesseract.js-core 7.0.0: Apache-2.0, licenses in `licenses/`.
Language files ita/eng/fra/spa/por are the fixed npm distributions
`@tesseract.js-data/{lang}@1.0.0`, 4.0.0_best_int. Source:
https://github.com/naptha/tessdata (Apache-2.0). The npm package metadata declares
MIT for the package wrapper; upstream trained-data license is also included.

Browser bundles include upstream dependencies (bmp-js, zlibjs, idb-keyval,
is-url, regenerator-runtime, wasm-feature-detect). Preserve the license notices
embedded in the original distributables. AETERNA application code does not
modify the vendored bundles or trained weights. File SHA-256 and tarball
SHA-512 digests are recorded in `manifest.json`; no npm install scripts were run.

Official source: https://github.com/naptha/tesseract.js

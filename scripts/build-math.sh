#!/bin/sh
# Compiles the pure-logic modules in src/lib to plain JS so Node's built-in test
# runner can exercise them without a bundler, an emulator or a network.
set -e
rm -rf .math-build
npx tsc --ignoreConfig \
  src/lib/money.ts src/lib/split.ts src/lib/balance.ts src/lib/cloudinary.ts src/lib/pushMessages.ts \
  --outDir .math-build --module commonjs --target es2020 \
  --moduleResolution node --skipLibCheck --ignoreDeprecations 6.0

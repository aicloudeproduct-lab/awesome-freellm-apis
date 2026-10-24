#!/usr/bin/env bash
# Render a handful of full-res stills for QA: tools/stills.sh 30 200 390 ...
set -e
cd "$(dirname "$0")/.."
mkdir -p build/stills
npx remotion bundle src/index.ts --out-dir=build/bundle --log=error >/dev/null
for f in "$@"; do
  npx remotion still build/bundle BesUaqyt "build/stills/s$f.png" --frame="$f" --log=error &
  while [ "$(jobs -r | wc -l)" -ge 3 ]; do sleep 0.5; done
done
wait

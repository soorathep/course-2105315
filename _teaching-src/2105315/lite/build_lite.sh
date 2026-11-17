#!/bin/sh
# Build the course JupyterLite into teaching/2105315/lite/.
#   pip install jupyterlite-core==0.8.7 jupyterlite-pyodide-kernel==0.8.7
#   sh _teaching-src/2105315/lite/build_lite.sh
# Python itself (Pyodide) loads from cdn.jsdelivr.net when a student opens the page.
set -e
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../../.." && pwd)
out="$repo/teaching/2105315/lite"
python3 "$here/make_start.py"
rm -rf "$out"
cd "$here"
jupyter lite build --contents content --piplite-wheels wheels/comm-0.2.3-py3-none-any.whl --output-dir "$out"
find "$out" -name '*.map' -delete
rm -f "$out"/rspack.config*.js "$out"/package.json
rm -rf "$here/.jupyterlite.doit.db" "$here/_output" "$here/.cache"

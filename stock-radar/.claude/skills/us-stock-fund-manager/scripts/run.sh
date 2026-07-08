#!/bin/bash
# Bootstrap venv (pandas) once, then run radar_run.py with all args passed through.
# Intended cwd: the stock-radar project root.
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
VENV="$HERE/.venv"
if [ ! -x "$VENV/bin/python" ]; then
  echo "[run.sh] creating venv + installing pandas (one-time)..." >&2
  python3 -m venv "$VENV"
  "$VENV/bin/pip" -q install pandas
fi
exec "$VENV/bin/python" "$HERE/radar_run.py" "$@"

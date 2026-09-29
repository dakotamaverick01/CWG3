#!/bin/bash
# Move Grok sheets that Claude saved to ~/Downloads into assets/incoming, then run intake.
# Usage (from the CWG3 folder):  bash tools/grab_downloads.sh
cd "$(dirname "$0")/.." || exit 1
moved=0
for f in "$HOME"/Downloads/1[1-9]_*.jpg "$HOME"/Downloads/[2-9][0-9]_*.jpg; do
  [ -e "$f" ] || continue
  mv -n "$f" assets/incoming/ && echo "moved $(basename "$f")" && moved=$((moved+1))
done
[ $moved -eq 0 ] && echo "nothing new in ~/Downloads"
python3 tools/intake.py --review

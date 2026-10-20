#!/usr/bin/env bash
# Renders every Squik diorama with Aseprite, day and night: the homepage hero
# and the compress, merge and trim scenes for the encoding screen. Writes the
# animated WebPs, reduced-motion stills, and the sun and moon sprites into
# public/hero. All scenes share diorama.lua.
# Usage: ./build.sh [scene...]   (default: all; set ASEPRITE if Aseprite is not in the default place)
set -euo pipefail

ASEPRITE="${ASEPRITE:-/Applications/Aseprite.app/Contents/MacOS/aseprite}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PUBLIC="$HERE/../../public/hero"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

SCENES=("$@")
[ ${#SCENES[@]} -eq 0 ] && SCENES=(hero compress merge trim)

mkdir -p "$PUBLIC"
for scene in "${SCENES[@]}"; do
  for variant in day night; do
    "$ASEPRITE" -b --script-param lib="$HERE/diorama.lua" --script-param out="$WORK" \
      --script-param variant="$variant" --script "$HERE/squik_$scene.lua"
    sprite="$WORK/squik_${scene}_$variant.aseprite"
    "$ASEPRITE" -b "$sprite" --save-as "$PUBLIC/squik-$scene-$variant.webp"
    "$ASEPRITE" -b --frame-range 0,0 "$sprite" --save-as "$PUBLIC/squik-$scene-$variant-still.png"
  done
done

# Sun and moon, layered behind every scene by the site.
"$ASEPRITE" -b --script-param out="$PUBLIC" --script "$HERE/celestial.lua"

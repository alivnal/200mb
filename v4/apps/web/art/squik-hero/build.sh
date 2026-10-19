#!/usr/bin/env bash
# Renders the day and night Squik hero with Aseprite and writes the animated
# WebPs, reduced-motion stills, and the sun and moon sprites into public/hero.
# Usage: ./build.sh   (set ASEPRITE if Aseprite is not in the default place)
set -euo pipefail

ASEPRITE="${ASEPRITE:-/Applications/Aseprite.app/Contents/MacOS/aseprite}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PUBLIC="$HERE/../../public/hero"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

mkdir -p "$PUBLIC"
for variant in day night; do
  "$ASEPRITE" -b --script-param out="$WORK" --script-param variant="$variant" \
    --script "$HERE/squik_hero.lua"
  sprite="$WORK/squik_hero_$variant.aseprite"
  "$ASEPRITE" -b "$sprite" --save-as "$PUBLIC/squik-hero-$variant.webp"
  "$ASEPRITE" -b --frame-range 0,0 "$sprite" --save-as "$PUBLIC/squik-hero-$variant-still.png"
done

# Sun and moon, layered behind the scene by the site.
"$ASEPRITE" -b --script-param out="$PUBLIC" --script "$HERE/celestial.lua"

#!/bin/bash
# Generate Tauri icons from SVG
# Requires: librsvg (brew install librsvg) or ImageMagick

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ICON_DIR="$SCRIPT_DIR/../src-tauri/icons"
SVG_FILE="$ICON_DIR/icon.svg"

echo "Generating icons from $SVG_FILE..."

# Check if rsvg-convert is available
if command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICON_DIR/32x32.png"
    rsvg-convert -w 128 -h 128 "$SVG_FILE" > "$ICON_DIR/128x128.png"
    rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICON_DIR/128x128@2x.png"
    rsvg-convert -w 512 -h 512 "$SVG_FILE" > "$ICON_DIR/icon.png"
    echo "PNG icons generated!"

    # For macOS icns, use iconutil
    if command -v iconutil &> /dev/null; then
        ICONSET_DIR="$ICON_DIR/icon.iconset"
        mkdir -p "$ICONSET_DIR"
        rsvg-convert -w 16 -h 16 "$SVG_FILE" > "$ICONSET_DIR/icon_16x16.png"
        rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICONSET_DIR/icon_16x16@2x.png"
        rsvg-convert -w 32 -h 32 "$SVG_FILE" > "$ICONSET_DIR/icon_32x32.png"
        rsvg-convert -w 64 -h 64 "$SVG_FILE" > "$ICONSET_DIR/icon_32x32@2x.png"
        rsvg-convert -w 128 -h 128 "$SVG_FILE" > "$ICONSET_DIR/icon_128x128.png"
        rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICONSET_DIR/icon_128x128@2x.png"
        rsvg-convert -w 256 -h 256 "$SVG_FILE" > "$ICONSET_DIR/icon_256x256.png"
        rsvg-convert -w 512 -h 512 "$SVG_FILE" > "$ICONSET_DIR/icon_256x256@2x.png"
        rsvg-convert -w 512 -h 512 "$SVG_FILE" > "$ICONSET_DIR/icon_512x512.png"
        rsvg-convert -w 1024 -h 1024 "$SVG_FILE" > "$ICONSET_DIR/icon_512x512@2x.png"
        iconutil -c icns "$ICONSET_DIR" -o "$ICON_DIR/icon.icns"
        rm -rf "$ICONSET_DIR"
        echo "macOS icon.icns generated!"
    fi
elif command -v convert &> /dev/null; then
    # ImageMagick fallback
    convert -background none "$SVG_FILE" -resize 32x32 "$ICON_DIR/32x32.png"
    convert -background none "$SVG_FILE" -resize 128x128 "$ICON_DIR/128x128.png"
    convert -background none "$SVG_FILE" -resize 256x256 "$ICON_DIR/128x128@2x.png"
    convert -background none "$SVG_FILE" -resize 512x512 "$ICON_DIR/icon.png"
    echo "PNG icons generated with ImageMagick!"
else
    echo "Error: Neither rsvg-convert nor ImageMagick found."
    echo "Install with: brew install librsvg"
    exit 1
fi

# Create a simple .ico for Windows (if convert is available)
if command -v convert &> /dev/null; then
    convert "$ICON_DIR/32x32.png" "$ICON_DIR/128x128.png" "$ICON_DIR/icon.ico" 2>/dev/null || true
fi

echo "Done!"

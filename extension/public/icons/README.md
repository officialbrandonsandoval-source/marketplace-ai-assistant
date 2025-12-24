# Icon Files Placeholder

The extension requires icon files in multiple sizes:
- icon16.png
- icon32.png
- icon48.png
- icon128.png

## Generate Icons (Phase 2)

Use an icon generation tool or design software to create proper icons from `icon.svg`.

For development, you can generate placeholder PNGs:

```bash
# Using ImageMagick (if installed)
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 32x32 icon32.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png
```

Or use an online tool like:
- https://favicon.io/
- https://realfavicongenerator.net/

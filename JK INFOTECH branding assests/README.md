# JK Infotech — Digital Asset Package (ICO & SVG)

Brand color: `#1B4D7A` (deep navy blue) on white.
Wordmark typeface: geometric sans-serif, bold weight, vectorized to outline
paths (font-independent, renders identically on every platform).

## 1. ICO — `ico/jk-infotech-icon.ico`

Single multi-resolution container, 32-bit color with 8-bit alpha channel.
Embedded sizes:

| Size      | Use case                  |
|-----------|----------------------------|
| 256×256   | Master / high-DPI shell    |
| 128×128   | Large app icons            |
| 64×64     | Windows app icons          |
| 48×48     | Windows app icons          |
| 32×32     | Toolbars / system tray     |
| 16×16     | Favicon (browser tab)      |

## 2. SVG — `svg/`

| File | Variant | Use case |
|---|---|---|
| `jk-infotech-A-primary-lockup.svg` | Primary logo lockup (icon stacked over wordmark) | Default brand lockup — letterheads, splash screens, marketing |
| `jk-infotech-B-horizontal-lockup.svg` | Horizontal secondary lockup (icon + inline wordmark) | Narrow layouts — software headers, nav bars |
| `jk-infotech-C-standalone-monogram.svg` | Standalone monogram (icon only) | Icon-only usage — app buttons, profile pictures |
| `jk-infotech-D-text-only-mark.svg` | Text-only wordmark | Clean text applications, footers, letterpress contexts |

All SVGs use outlined vector paths for both the monogram and the wordmark
text — no `<text>` elements and no font dependency, so they render
identically across every browser, OS, and design tool.

## Source

`jk-monogram-master.svg` — the master 512×512 vector monogram all other
assets are scaled from.

# SMB Mounter Icon Refresh Design

## Goal

Replace the current solid-color Dock and menu bar icons with a clearer "network disk" visual identity.

The app should read as a macOS utility for mounted network storage, not as a generic blue square or status light.

## Visual Direction

Use a network disk metaphor:

- Dock icon: a simple external/network disk with subtle depth, plus a small network connection node.
- Menu bar icons: a simplified hard-drive outline with a small status dot.

Do not use text such as "SMB" inside the icon. Text will be unreadable at menu bar sizes and weak at smaller Dock sizes.

## Dock Icon

The Dock icon should be a full macOS app icon:

- Rounded-square app icon canvas.
- Dark gray to silver disk body.
- Small network node or connection mark near the disk.
- Blue-green accent for the active network/storage identity.
- Clean silhouette that remains recognizable at small Dock sizes.

The generated assets must include the full `build/icon.iconset` sizes and `build/icon.icns`.

## Menu Bar Icons

The menu bar icons should stay minimal:

- Transparent background.
- Monochrome hard-drive outline as the main glyph.
- Status dot in the lower-right corner.
- Three variants:
  - `trayConnected.png`: green status dot.
  - `trayDisconnected.png`: gray status dot.
  - `trayError.png`: red status dot.

The glyph must remain legible at 16x16. Source generation should produce at least 16x16 and high-density 32x32 variants if the implementation keeps richer source assets.

## Implementation Boundaries

Keep implementation limited to icon generation and asset wiring:

- Update the icon-generation script or replace it with a small deterministic asset generator.
- Regenerate `assets/` tray icons.
- Regenerate `build/icon.iconset/` and `build/icon.icns`.
- Keep package configuration using `build/icon.icns`.

No renderer layout or mount behavior changes are part of this work.

## Verification

Verify with:

- Inspect generated PNG dimensions.
- Run `iconutil` generation successfully.
- Run `npm run build`.
- Run `npm run dist`.
- Start the packaged app and confirm it still launches.
- Visually check Dock and menu bar icons in both light and dark macOS menu bar contexts when practical.

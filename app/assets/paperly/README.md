# The Paperly app icon

One drawing, one page, every size. `icon.html` composes the icon in a browser
and `build-icons.sh` screenshots it with headless Chrome, so changing the look
means editing CSS, not re-exporting a dozen files by hand.

```bash
./build-icons.sh            # the shipped look, "plum"
./build-icons.sh cream      # also: sage, rose
CHROME=/path/to/chrome ./build-icons.sh
```

It writes, in place:

| File | Used by |
| --- | --- |
| `../../mac/Contents/Resources/paperly.icns` | the macOS bundle, via `CFBundleIconFile` |
| `../../win/zotero.ico` | the Windows executable and installer |
| `../../linux/icons/icon{32,64,128}.png` | the Linux launcher |

The same page renders the web port's icons; see `paperly-web/docs/PORTING.md`.

## Why it is built this way

**The drawing sits on opaque white, and so does her shirt.** No colour key can
take one without the other, so `cutout()` floods inward from the border
instead: only the background touches the edge. Tolerance is 244, well above
her cream face.

**It is 200x200 with hard, aliased edges.** Stretching that to 1024 bilinear is
mush. The cutout is first blown up to 1200 with smoothing off, on whole
pixels, and the browser then scales *down* to whatever size is asked for —
crisp edges, no stair-steps.

**The corner is a superellipse, not a `border-radius`.** Apple's corner is
continuous and the difference shows the moment the icon sits beside a system
one. `squircle()` walks the curve directly.

**Light comes from below, not from behind her head.** A radial glow centred on
her head read as a sticker someone had cut out badly; it was tried and
replaced.

**`plum` is the shipped look** because it holds her silhouette at 32px better
than any of the light grounds -- her hair is pink, so a pink or cream ground
loses her outline -- and its burgundy keeps a thread back to Zotero's red.

## The macOS bundle no longer carries an asset catalogue

Stock Zotero shipped `Assets.car` holding nothing but the old `AppIcon`, named
from `CFBundleIconName`. Rebuilding one needs `actool`, which is Xcode-only --
a Command Line Tools install does not have it. So the catalogue is gone and
`Info.plist` names a `.icns` through `CFBundleIconFile` instead, which every
macOS version reads. Nothing else was in the catalogue; `assetutil --info`
listed only `AppIcon` and its layers.

If full Xcode is ever installed and the layered icon is wanted back, build an
`AppIcon.appiconset` from the rendered PNGs and compile it with `actool`.

## Traps

**Do not set the Finder custom-icon flag on the bundle.** `SetFile -a C` makes
Finder look for an `Icon\r` resource fork that is not there, and the app then
shows as a plain blue folder. Clear it with `SetFile -a c`. Measured with
`NSWorkspace.icon(forFile:)`, which is what the Dock asks.

**`--allow-file-access-from-files` is not optional.** Without it the canvas is
tainted, `getImageData` throws, and the flood fill cannot run -- the icon comes
out as the drawing on its white square.

**A dev build reads `app/staging/Zotero.app`, which is gitignored.** Installing
there is what makes the running instance change; committing the sources is what
makes the next build keep it. `build-icons.sh` does the second, not the first.

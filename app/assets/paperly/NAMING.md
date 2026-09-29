# Zotero → Paperly: what was renamed, and what was not

`Zotero` in this tree is four different things wearing one word, and only one
of them is a name anybody reads:

| It is | How many | What happened |
| --- | --- | --- |
| `Zotero.Items`, `Zotero.DB`, … — the JS namespace | ~21,600 | untouched |
| `chrome://zotero/…` — the package URL | ~820 | untouched |
| `zotero.org`, `api.zotero.org` — live servers | ~1,600 | untouched |
| `extensions.zotero.*`, `org.zotero.*`, `zotero.sqlite`, `zotero://`, `zotero-*` element ids | ~880 | untouched |
| The product name, in strings people read | ~6,900 | **Paperly** |

Renaming any of the first four would not change a word on screen and would
break the app, the 760 translators that call `Zotero.*`, the plugin, and sync.

## Where the name actually lives

`app/assets/branding/locale/brand.{dtd,properties,ftl}` is the Mozilla-style
branding file, and it is the highest-leverage edit in the tree: the main
window's title is `&brandShortName;`, and so is most of `standalone.dtd` and
all of `mozilla/*.dtd` in **every** locale. One line there renames the window
title, the macOS application menu, and the updater, in all 48 languages.

Zotero's own strings do not use the entity -- they spell "Zotero" out -- so
those were rewritten in `chrome/locale/`.

## The rule for strings

Rename it when it is **this application**. Keep it when it names **Zotero the
organisation**, something it runs, or something it sells:

- kept: `zotero.org`, Zotero Forums, Zotero sync server, Zotero File Storage,
  Zotero Storage, Zotero Connector, Zotero account, Zotero plugins directory,
  Zotero developers, Zotero RDF, Zotero for Firefox, Zotero Standalone, and
  "upgrade using Zotero 4.0" — a release that exists, where "Paperly 4.0" does
  not.
- renamed: everything else, from "Quit Zotero" to "Your Zotero database must
  be upgraded".

Six English strings say both at once (e.g. *"…in the **Paperly** preferences
to sync with the **Zotero** server."*). English handles them correctly.

## How the other 47 locales were done

Not by phrases -- "Zotero Forums" is "Zotero 论坛" in zh-CN and no phrase list
survives translation. By **key**: if English came out of a key with no
"Zotero" left in the value, that key names the application and every
translation of it was renamed. If English kept a "Zotero", the translation was
left exactly as it was.

That leaves the six mixed keys above still saying Zotero in the other 47
languages, where English now says Paperly. Deciding those needs someone who
reads the language; renaming them blindly would produce "Paperly server",
which is a lie in 47 languages instead of one.

## Deliberately still named Zotero

- **`org.zotero.zotero`**, the bundle identifier, and `zotero@zotero.org`.
  Changing them makes macOS treat this as a different application: new
  preferences, new keychain entries, a broken update channel.
- **The data directory** (`~/Zotero`) and the profile directory. Renaming
  these without a migration orphans an existing library.
- **`Zotero.app`** and the `zotero` executable, both hardcoded in
  `app/build.sh`. Renaming them breaks `Zotero-WebAI/scripts/dev-reload.sh`,
  which launches the staged build by path.
- **`zotero://`**, the protocol handler, and `ZoteroMessageWindow`, the
  Windows IPC window class.
- **`chrome/skin/default/zotero/zotero.svg`**, the old red wordmark. Nothing
  references it any more -- `about.xhtml` points at `paperly.svg` -- but it is
  left where upstream put it.

## Verifying a rename

The app packs its chrome into `Contents/Resources/app/omni.ja`, so editing
`chrome/locale/` changes nothing until `app/scripts/dir_build -p m` repacks
it. Then ask macOS rather than trusting the source:

```bash
osascript -e 'tell application "System Events" to tell process "zotero" \
  to get name of menu bar item 2 of menu bar 1'      # -> Paperly
osascript -e 'tell application "System Events" to tell process "zotero" \
  to get name of window 1'                            # -> "… - Paperly"
```

The process is still called `zotero` there because that is the executable's
filename, which is in the list above.

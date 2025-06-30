This is a modified version of the esmify tool from the fx115 tree:
  https://searchfox.org/mozilla-esr115/source/tools/esmify

Zotero modifications:
  - Make scripts work independently of Mach
  - Add Bluebird-to-async migration
  - Don't run a full ESLint --fix or fail if it can't fix everything, but do still try to fix
    a few basic issues introduced by jscodeshift
  - Fix VCS integration for our structure (and remove Mercurial)
  - Replace references to nonexistent "pathlib.os"
  - Add handling for Components.utils.import(), not just Cu.import()

Run:
  scripts/migrate-fx140/migrate.py <esmify|asyncify> [file_or_dir]

Special notes for esmify:
  - If the script you're running on is a window/XPCOM script, not an MJS/ESM, pass --imports

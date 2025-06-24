This is a modified version of the esmify tool from the fx115 tree:
  https://searchfox.org/mozilla-esr115/source/tools/esmify

Zotero modifications:
  - Make esmify.py work independently of Mach
  - Remove ESLint step
  - Fix VCS integration for our structure (and remove Mercurial)
  - Replace references to nonexistent "pathlib.os"
  - Add handling for Components.utils.import(), not just Cu.import()

Run:
  scripts/esmify/esmify.py [dir]

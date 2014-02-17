=========================
Multilingual Zotero (MLZ)
=========================

This is an experimental fork of the Zotero reference manager.
The modified version here is *not* an official release of Zotero,
and is not supported by the core project team. If you use this
release, you are on your own (well, *we* are on *our* own) for
support.

Features and other significant data points include:

* Support for multiple language versions of a field, extensible
  via a friendly interface using the BCP 47 language tagging
  standard (currently specified in `RFC 5646`__). This includes
  support for citation of foreign resources in documents via
  the standard Zotero word processor plugins, with translated
  or transliterated field content and alternative sort fields
  for Asian languages.
  
* Support for the `MLZ extended schema`__ for CSL styles,
  which enables certain functionality on which legal citation
  support depends.
  
* Compatibility with the `Abbreviations Gadget`__ (aka Abbreviations
  for Zotero), which enables and external abbreviations lists for
  specific styles.

* This version of the client is prepared and maintained by
  Frank Bennett, author of the ``citeproc-js`` citation
  processor that runs in official Zotero.
  
__ http://tools.ietf.org/html/rfc5646
__ http://gsl-nagoya-u.net/http/pub/citeproc-js-csl.html
__ http://citationstylist.org/tools/?#abbreviations-gadget-entry

That's the cool stuff. Note that this product is in constant
development, and while cursory testing is done before each
(rather frequent) release, you may experience problems from
time to time with a fresh version update. Be careful to keep
backups of your data if you are using this client.

With the caveats and bits of news out of the way, here is a
link to the installer page:

.. image:: https://github.com/fbennett/zotero/blob/master/mlz_button.png?raw=true
   :target: http://citationstylist.org/tools/?#mlz-client-entry

Enjoy!

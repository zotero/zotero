/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

// Based on Mozilla's autocomplete-input CE, with a different base class
// https://searchfox.org/mozilla-esr115/rev/20df84af4059268f2d011658e0b4d9aa66f7bcef/toolkit/content/widgets/autocomplete-input.js

// This is loaded into all XUL windows. Wrap in a block to prevent
// leaking to window scope.
{
  const { AppConstants } = ChromeUtils.importESModule(
    "resource://gre/modules/AppConstants.sys.mjs"
  );
  const { XPCOMUtils } = ChromeUtils.importESModule(
    "resource://gre/modules/XPCOMUtils.sys.mjs"
  );

  class AutocompleteTextArea extends HTMLTextAreaElement {
    constructor() {
      super();

      this.popupSelectedIndex = -1;

      XPCOMUtils.defineLazyPreferenceGetter(
        this,
        "disablePopupAutohide",
        "ui.popup.disable_autohide",
        false
      );

      this.addEventListener("input", event => {
        this.onInput(event);
      });

      this.addEventListener("keydown", event => this.handleKeyDown(event));

      this.addEventListener(
        "compositionstart",
        event => {
          if (
            this.mController.input.wrappedJSObject == this.nsIAutocompleteInput
          ) {
            this.mController.handleStartComposition();
          }
        },
        true
      );

      this.addEventListener(
        "compositionend",
        event => {
          if (
            this.mController.input.wrappedJSObject == this.nsIAutocompleteInput
          ) {
            this.mController.handleEndComposition();
          }
        },
        true
      );

      this.addEventListener(
        "focus",
        event => {
          this.attachController();
          if (
            window.gBrowser &&
            window.gBrowser.selectedBrowser.hasAttribute("usercontextid")
          ) {
            this.userContextId = parseInt(
              window.gBrowser.selectedBrowser.getAttribute("usercontextid")
            );
          } else {
            this.userContextId = 0;
          }
        },
        true
      );

      this.addEventListener(
        "blur",
        event => {
          if (!this._dontBlur) {
            if (this.forceComplete && this.mController.matchCount >= 1) {
              // If forceComplete is requested, we need to call the enter processing
              // on blur so the input will be forced to the closest match.
              // Thunderbird is the only consumer of forceComplete and this is used
              // to force an recipient's email to the exact address book entry.
              this.mController.handleEnter(true);
            }
            if (!this.ignoreBlurWhileSearching) {
              this._dontClosePopup = this.disablePopupAutohide;
              this.detachController();
            }
          }
        },
        true
      );
    }

    connectedCallback() {
      this.setAttribute("is", "autocomplete-textarea");
      this.setAttribute("autocomplete", "off");

      this.mController = Cc[
        "@mozilla.org/autocomplete/controller;1"
      ].getService(Ci.nsIAutoCompleteController);
      this.mSearchNames = null;
      this.mIgnoreInput = false;
      this.noRollupOnEmptySearch = false;

      this._popup = null;

      this.nsIAutocompleteInput = this.getCustomInterfaceCallback(
        Ci.nsIAutoCompleteInput
      );

      this.valueIsTyped = false;
    }

    get popup() {
      // Memoize the result in a field rather than replacing this property,
      // so that it can be reset along with the binding.
      if (this._popup) {
        return this._popup;
      }

      let popup = null;
      let popupId = this.getAttribute("autocompletepopup");
      if (popupId) {
        popup = document.getElementById(popupId);
      }

      /* This path is only used in tests, we have the <popupset> and <panel>
         in document for other usages */
      if (!popup) {
        popup = document.createXULElement("panel", {
          is: "autocomplete-richlistbox-popup",
        });
        popup.setAttribute("type", "autocomplete-richlistbox");
        popup.setAttribute("noautofocus", "true");

        if (!this._popupset) {
          this._popupset = document.createXULElement("popupset");
          document.documentElement.appendChild(this._popupset);
        }

        this._popupset.appendChild(popup);
      }
      popup.mInput = this;

      return (this._popup = popup);
    }

    get popupElement() {
      return this.popup;
    }

    get controller() {
      return this.mController;
    }

    set popupOpen(val) {
      if (val) {
        this.openPopup();
      } else {
        this.closePopup();
      }
    }

    get popupOpen() {
      return this.popup.popupOpen;
    }

    set disableAutoComplete(val) {
      this.setAttribute("disableautocomplete", val);
    }

    get disableAutoComplete() {
      return this.getAttribute("disableautocomplete") == "true";
    }

    set completeDefaultIndex(val) {
      this.setAttribute("completedefaultindex", val);
    }

    get completeDefaultIndex() {
      return this.getAttribute("completedefaultindex") == "true";
    }

    set completeSelectedIndex(val) {
      this.setAttribute("completeselectedindex", val);
    }

    get completeSelectedIndex() {
      return this.getAttribute("completeselectedindex") == "true";
    }

    set forceComplete(val) {
      this.setAttribute("forcecomplete", val);
    }

    get forceComplete() {
      return this.getAttribute("forcecomplete") == "true";
    }

    set minResultsForPopup(val) {
      this.setAttribute("minresultsforpopup", val);
    }

    get minResultsForPopup() {
      var m = parseInt(this.getAttribute("minresultsforpopup"));
      return isNaN(m) ? 1 : m;
    }

    set timeout(val) {
      this.setAttribute("timeout", val);
    }

    get timeout() {
      var t = parseInt(this.getAttribute("timeout"));
      return isNaN(t) ? 50 : t;
    }

    set searchParam(val) {
      this.setAttribute("autocompletesearchparam", val);
    }

    get searchParam() {
      return this.getAttribute("autocompletesearchparam") || "";
    }

    get searchCount() {
      this.initSearchNames();
      return this.mSearchNames.length;
    }

    get inPrivateContext() {
      throw new Error('Unimplemented');
    }

    get noRollupOnCaretMove() {
      return this.popup.getAttribute("norolluponanchor") == "true";
    }

    set textValue(val) {
      // "input" event is automatically dispatched by the editor if
      // necessary.
      this._setValueInternal(val, true);
    }

    get textValue() {
      return this.value;
    }
    /**
     * =================== nsIDOMXULMenuListElement ===================
     */
    get editable() {
      return true;
    }

    set open(val) {
      if (val) {
        this.showHistoryPopup();
      } else {
        this.closePopup();
      }
    }

    get open() {
      return this.getAttribute("open") == "true";
    }

    set value(val) {
      this._setValueInternal(val, false);
    }

    get value() {
      return super.value;
    }

    get focused() {
      return this === document.activeElement;
    }
    /**
     * maximum number of rows to display at a time when opening the popup normally
     * (e.g., focus element and press the down arrow)
     */
    set maxRows(val) {
      this.setAttribute("maxrows", val);
    }

    get maxRows() {
      return parseInt(this.getAttribute("maxrows")) || 0;
    }
    /**
     * maximum number of rows to display at a time when opening the popup by
     * clicking the dropmarker (for inputs that have one)
     */
    set maxdropmarkerrows(val) {
      this.setAttribute("maxdropmarkerrows", val);
    }

    get maxdropmarkerrows() {
      return parseInt(this.getAttribute("maxdropmarkerrows"), 10) || 14;
    }
    /**
     * option to allow scrolling through the list via the tab key, rather than
     * tab moving focus out of the textbox
     */
    set tabScrolling(val) {
      this.setAttribute("tabscrolling", val);
    }

    get tabScrolling() {
      return this.getAttribute("tabscrolling") == "true";
    }
    /**
     * option to completely ignore any blur events while searches are
     * still going on.
     */
    set ignoreBlurWhileSearching(val) {
      this.setAttribute("ignoreblurwhilesearching", val);
    }

    get ignoreBlurWhileSearching() {
      return this.getAttribute("ignoreblurwhilesearching") == "true";
    }
    /**
     * option to highlight entries that don't have any matches
     */
    set highlightNonMatches(val) {
      this.setAttribute("highlightnonmatches", val);
    }

    get highlightNonMatches() {
      return this.getAttribute("highlightnonmatches") == "true";
    }

    getSearchAt(aIndex) {
      this.initSearchNames();
      return this.mSearchNames[aIndex];
    }

    selectTextRange(aStartIndex, aEndIndex) {
      super.setSelectionRange(aStartIndex, aEndIndex);
    }

    onSearchBegin() {
      if (this.popup && typeof this.popup.onSearchBegin == "function") {
        this.popup.onSearchBegin();
      }
    }

    onSearchComplete() {
      if (this.mController.matchCount == 0) {
        this.setAttribute("nomatch", "true");
      } else {
        this.removeAttribute("nomatch");
      }

      if (this.ignoreBlurWhileSearching && !this.focused) {
        this.handleEnter();
        this.detachController();
      }
    }

    onTextEntered(event) {
      if (this.getAttribute("notifylegacyevents") === "true") {
        let e = new CustomEvent("textEntered", {
          bubbles: false,
          cancelable: true,
          detail: { rootEvent: event },
        });
        return !this.dispatchEvent(e);
      }
      return false;
    }

    onTextReverted(event) {
      if (this.getAttribute("notifylegacyevents") === "true") {
        let e = new CustomEvent("textReverted", {
          bubbles: false,
          cancelable: true,
          detail: { rootEvent: event },
        });
        return !this.dispatchEvent(e);
      }
      return false;
    }

    /**
     * =================== PRIVATE MEMBERS ===================
     */

    /*
     * ::::::::::::: autocomplete controller :::::::::::::
     */

    attachController() {
      this.mController.input = this.nsIAutocompleteInput;
    }

    detachController() {
      if (
        this.mController.input &&
        this.mController.input.wrappedJSObject == this.nsIAutocompleteInput
      ) {
        this.mController.input = null;
      }
    }

    /**
     * ::::::::::::: popup opening :::::::::::::
     */
    openPopup() {
      if (this.focused) {
        this.popup.openAutocompletePopup(this.nsIAutocompleteInput, this);
      }
    }

    closePopup() {
      if (this._dontClosePopup) {
        delete this._dontClosePopup;
        return;
      }
      this.popup.closePopup();
    }

    showHistoryPopup() {
      // Store our "normal" maxRows on the popup, so that it can reset the
      // value when the popup is hidden.
      this.popup._normalMaxRows = this.maxRows;

      // Temporarily change our maxRows, since we want the dropdown to be a
      // different size in this case. The popup's popupshowing/popuphiding
      // handlers will take care of resetting this.
      this.maxRows = this.maxdropmarkerrows;

      // Ensure that we have focus.
      if (!this.focused) {
        this.focus();
      }
      this.attachController();
      this.mController.startSearch("");
    }

    toggleHistoryPopup() {
      if (!this.popup.popupOpen) {
        this.showHistoryPopup();
      } else {
        this.closePopup();
      }
    }

    handleKeyDown(aEvent) {
      // Re: urlbarDeferred, see the comment in urlbarBindings.xml.
      if (aEvent.defaultPrevented && !aEvent.urlbarDeferred) {
        return false;
      }

      if (
        typeof this.onBeforeHandleKeyDown == "function" &&
        this.onBeforeHandleKeyDown(aEvent)
      ) {
        return true;
      }

      const isMac = AppConstants.platform == "macosx";
      var cancel = false;

      // Catch any keys that could potentially move the caret. Ctrl can be
      // used in combination with these keys on Windows and Linux; and Alt
      // can be used on OS X, so make sure the unused one isn't used.
      let metaKey = isMac ? aEvent.ctrlKey : aEvent.altKey;
      if (!metaKey) {
        switch (aEvent.keyCode) {
          case KeyEvent.DOM_VK_LEFT:
          case KeyEvent.DOM_VK_RIGHT:
          case KeyEvent.DOM_VK_HOME:
            cancel = this.mController.handleKeyNavigation(aEvent.keyCode);
            break;
        }
      }

      // Handle keys that are not part of a keyboard shortcut (no Ctrl or Alt)
      if (!aEvent.ctrlKey && !aEvent.altKey) {
        switch (aEvent.keyCode) {
          case KeyEvent.DOM_VK_TAB:
            if (this.tabScrolling && this.popup.popupOpen) {
              cancel = this.mController.handleKeyNavigation(
                aEvent.shiftKey ? KeyEvent.DOM_VK_UP : KeyEvent.DOM_VK_DOWN
              );
            } else if (this.forceComplete && this.mController.matchCount >= 1) {
              this.mController.handleTab();
            }
            break;
          case KeyEvent.DOM_VK_UP:
          case KeyEvent.DOM_VK_DOWN:
          case KeyEvent.DOM_VK_PAGE_UP:
          case KeyEvent.DOM_VK_PAGE_DOWN:
            cancel = this.mController.handleKeyNavigation(aEvent.keyCode);
            break;
        }
      }

      // Handle readline/emacs-style navigation bindings on Mac.
      if (
        isMac &&
        this.popup.popupOpen &&
        aEvent.ctrlKey &&
        (aEvent.key === "n" || aEvent.key === "p")
      ) {
        const effectiveKey =
          aEvent.key === "p" ? KeyEvent.DOM_VK_UP : KeyEvent.DOM_VK_DOWN;
        cancel = this.mController.handleKeyNavigation(effectiveKey);
      }

      // Handle keys we know aren't part of a shortcut, even with Alt or
      // Ctrl.
      switch (aEvent.keyCode) {
        case KeyEvent.DOM_VK_ESCAPE:
          cancel = this.mController.handleEscape();
          break;
        case KeyEvent.DOM_VK_RETURN:
          if (isMac) {
            // Prevent the default action, since it will beep on Mac
            if (aEvent.metaKey) {
              aEvent.preventDefault();
            }
          }
          if (this.popup.selectedIndex >= 0) {
            this.popupSelectedIndex = this.popup.selectedIndex;
          }
          cancel = this.handleEnter(aEvent);
          break;
        case KeyEvent.DOM_VK_DELETE:
          if (isMac && !aEvent.shiftKey) {
            break;
          }
          cancel = this.handleDelete();
          break;
        case KeyEvent.DOM_VK_BACK_SPACE:
          if (isMac && aEvent.shiftKey) {
            cancel = this.handleDelete();
          }
          break;
        case KeyEvent.DOM_VK_DOWN:
        case KeyEvent.DOM_VK_UP:
          if (aEvent.altKey) {
            this.toggleHistoryPopup();
          }
          break;
        case KeyEvent.DOM_VK_F4:
          if (!isMac) {
            this.toggleHistoryPopup();
          }
          break;
      }

      if (cancel) {
        aEvent.stopPropagation();
        aEvent.preventDefault();
      }

      return true;
    }

    handleEnter(event) {
      return this.mController.handleEnter(false, event || null);
    }

    handleDelete() {
      return this.mController.handleDelete();
    }

    /**
     * ::::::::::::: miscellaneous :::::::::::::
     */
    initSearchNames() {
      if (!this.mSearchNames) {
        var names = this.getAttribute("autocompletesearch");
        if (!names) {
          this.mSearchNames = [];
        } else {
          this.mSearchNames = names.split(" ");
        }
      }
    }

    _focus() {
      this._dontBlur = true;
      this.focus();
      this._dontBlur = false;
    }

    resetActionType() {
      if (this.mIgnoreInput) {
        return;
      }
      this.removeAttribute("actiontype");
    }

    _setValueInternal(value, isUserInput) {
      this.mIgnoreInput = true;

      if (typeof this.onBeforeValueSet == "function") {
        value = this.onBeforeValueSet(value);
      }

      this.valueIsTyped = false;
      if (isUserInput) {
        super.setUserInput(value);
      } else {
        super.value = value;
      }

      this.mIgnoreInput = false;
      var event = document.createEvent("Events");
      event.initEvent("ValueChange", true, true);
      super.dispatchEvent(event);
      return value;
    }

    onInput(aEvent) {
      if (
        !this.mIgnoreInput &&
        this.mController.input.wrappedJSObject == this.nsIAutocompleteInput
      ) {
        this.valueIsTyped = true;
        this.mController.handleText();
      }
      this.resetActionType();
    }
  }

  MozHTMLElement.implementCustomInterface(AutocompleteTextArea, [
    Ci.nsIAutoCompleteInput,
    Ci.nsIDOMXULMenuListElement,
  ]);
  customElements.define("autocomplete-textarea", AutocompleteTextArea, {
    extends: "textarea",
  });
}

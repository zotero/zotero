// Adapted from Mozilla toolkit/content/widgets/search-textbox.js, removed in Firefox 153
// Modified to not set aria-autocomplete, which confuses screen readers

// -*- indent-tabs-mode: nil; js-indent-level: 2 -*-

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

{
  class MozSearchTextbox extends MozXULElement {
    constructor() {
      super();

      MozXULElement.insertFTLIfNeeded("toolkit/global/textActions.ftl");

      this.inputField = document.createElement("input");

      const METHODS = [
        "focus",
        "blur",
        "select",
        "setUserInput",
        "setSelectionRange",
      ];
      for (const method of METHODS) {
        this[method] = (...args) => this.inputField[method](...args);
      }

      const READ_WRITE_PROPERTIES = [
        "defaultValue",
        "placeholder",
        "readOnly",
        "size",
        "selectionStart",
        "selectionEnd",
      ];
      for (const property of READ_WRITE_PROPERTIES) {
        Object.defineProperty(this, property, {
          enumerable: true,
          get() {
            return this.inputField[property];
          },
          set(val) {
            this.inputField[property] = val;
          },
        });
      }

      this.attachShadow({ mode: "open" });
      this.addEventListener("input", this);
      this.addEventListener("keypress", this);
      this.addEventListener("mousedown", this);
    }

    static get inheritedAttributes() {
      return {
        input:
          "value,maxlength,disabled,size,readonly,placeholder,tabindex,accesskey,inputmode,spellcheck",
        ".textbox-search-icon": "label=searchbuttonlabel,disabled",
        ".textbox-search-clear": "disabled",
      };
    }

    connectedCallback() {
      if (this.delayConnectedCallback() || this.connected) {
        return;
      }

      document.l10n.connectRoot(this.shadowRoot);

      this.connected = true;
      this.textContent = "";

      const stylesheet = document.createElement("link");
      stylesheet.rel = "stylesheet";
      stylesheet.href = "chrome://zotero/skin/search-textbox.css";

      const textboxSign = document.createXULElement("image");
      textboxSign.className = "textbox-search-sign";
      textboxSign.part = "search-sign";

      const input = this.inputField;
      input.setAttribute("inputmode", "search");
      input.autocomplete = "off"; // not applicable in XUL docs and confuses aria.
      input.addEventListener("focus", this);
      input.addEventListener("blur", this);

      const searchBtn = (this._searchButtonIcon =
        document.createXULElement("image"));
      searchBtn.className = "textbox-search-icon";
      searchBtn.addEventListener("click", e => this._iconClick(e));

      const clearBtn = document.createXULElement("image");
      clearBtn.className = "textbox-search-clear";
      clearBtn.part = "clear-icon";
      clearBtn.setAttribute("role", "button");
      document.l10n.setAttributes(
        clearBtn,
        "text-action-search-text-box-clear"
      );
      clearBtn.addEventListener("click", () => this._clearSearch());

      const deck = (this._searchIcons = document.createXULElement("deck"));
      deck.className = "textbox-search-icons";
      deck.append(searchBtn, clearBtn);
      this.shadowRoot.append(stylesheet, textboxSign, input, deck);

      this._timer = null;

      // Ensure the button state is up to date:
      // eslint-disable-next-line no-self-assign
      this.searchButton = this.searchButton;

      this.initializeAttributeInheritance();
    }

    disconnectedCallback() {
      document.l10n.disconnectRoot(this.shadowRoot);
    }

    set timeout(val) {
      this.setAttribute("timeout", val);
    }

    get timeout() {
      return parseInt(this.getAttribute("timeout")) || 500;
    }

    set searchButton(val) {
      if (val) {
        this.setAttribute("searchbutton", "true");
        this.inputField.removeAttribute("aria-autocomplete");
        this._searchButtonIcon.setAttribute("role", "button");
      } else {
        this.removeAttribute("searchbutton");
        this._searchButtonIcon.setAttribute("role", "none");
      }
    }

    get searchButton() {
      return this.getAttribute("searchbutton") == "true";
    }

    set value(val) {
      this.inputField.value = val;

      if (val) {
        this._searchIcons.selectedIndex = this.searchButton ? 0 : 1;
      } else {
        this._searchIcons.selectedIndex = 0;
      }

      if (this._timer) {
        clearTimeout(this._timer);
      }
    }

    get value() {
      return this.inputField.value;
    }

    get editor() {
      return this.inputField.editor;
    }

    set disabled(val) {
      this.inputField.disabled = val;
      if (val) {
        this.setAttribute("disabled", "true");
      } else {
        this.removeAttribute("disabled");
      }
    }

    get disabled() {
      return this.inputField.disabled;
    }

    on_blur() {
      this.removeAttribute("focused");
    }

    on_focus() {
      this.setAttribute("focused", "true");
    }

    on_input() {
      if (this.searchButton) {
        this._searchIcons.selectedIndex = 0;
        return;
      }
      if (this._timer) {
        clearTimeout(this._timer);
      }
      this._timer =
        this.timeout && setTimeout(this._fireCommand, this.timeout, this);
      this._searchIcons.selectedIndex = this.value ? 1 : 0;
    }

    on_keypress(event) {
      switch (event.keyCode) {
        case KeyEvent.DOM_VK_ESCAPE:
          if (this._clearSearch()) {
            event.preventDefault();
            event.stopPropagation();
          }
          break;
        case KeyEvent.DOM_VK_RETURN:
          this._enterSearch();
          event.preventDefault();
          event.stopPropagation();
          break;
      }
    }

    on_mousedown() {
      if (!this.hasAttribute("focused")) {
        this.setSelectionRange(0, 0);
        this.focus();
      }
    }

    _fireCommand(me) {
      if (me._timer) {
        clearTimeout(me._timer);
      }
      me._timer = null;
      me.doCommand();
    }

    _iconClick() {
      if (this.searchButton) {
        this._enterSearch();
      } else {
        this.focus();
      }
    }

    _enterSearch() {
      if (this.disabled) {
        return;
      }
      if (this.searchButton && this.value && !this.readOnly) {
        this._searchIcons.selectedIndex = 1;
      }
      this._fireCommand(this);
    }

    _clearSearch() {
      if (!this.disabled && !this.readOnly && this.value) {
        this.value = "";
        this._fireCommand(this);
        this._searchIcons.selectedIndex = 0;
        return true;
      }
      return false;
    }
  }

  customElements.define("search-textbox", MozSearchTextbox);
}

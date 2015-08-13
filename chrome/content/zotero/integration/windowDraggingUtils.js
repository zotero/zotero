/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org Code.
 *
 * The Initial Developer of the Original Code is
 * Markus Stange <mstange@themasta.com>.
 * Portions created by the Initial Developer are Copyright (C) 2008
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

let EXPORTED_SYMBOLS = [ "WindowDraggingElement" ];

function WindowDraggingElement(elem, window) {
  this._elem = elem;
  this._window = window;
  this._elem.addEventListener("mousedown", this, false);
}

WindowDraggingElement.prototype = {
  mouseDownCheck: function(e) { return true; },
  dragTags: ["box", "hbox", "vbox", "spacer", "label", "statusbarpanel", "stack",
             "toolbaritem", "toolbarseparator", "toolbarspring", "toolbarspacer",
             "radiogroup", "deck", "scrollbox", "arrowscrollbox", "tabs"],
  shouldDrag: function(aEvent) {
    if (aEvent.button != 0 ||
        this._window.fullScreen ||
        !this.mouseDownCheck.call(this._elem, aEvent) ||
        aEvent.defaultPrevented)
      return false;

    let target = aEvent.originalTarget, parent = aEvent.originalTarget;

    // The target may be inside an embedded iframe or browser. (bug 615152)
    if (target.ownerDocument.defaultView != this._window)
      return false;

    while (parent != this._elem) {
      let mousethrough = parent.getAttribute("mousethrough");
      if (mousethrough == "always")
        target = parent.parentNode;
      else if (mousethrough == "never")
        break;
      parent = parent.parentNode;
    }
    while (target != this._elem) {
      if (this.dragTags.indexOf(target.localName) == -1)
        return false;
      target = target.parentNode;
    }
    return true;
  },
  isPanel : function() {
    return this._elem instanceof Components.interfaces.nsIDOMXULElement &&
           this._elem.localName == "panel";
  },
  handleEvent: function(aEvent) {
    let isPanel = this.isPanel();

    switch (aEvent.type) {
      case "mousedown":
        if (!this.shouldDrag(aEvent))
          return;

        if (isPanel) {
          let screenRect = this._elem.getOuterScreenRect();
          this._deltaX = aEvent.screenX - screenRect.left;
          this._deltaY = aEvent.screenY - screenRect.top;
        }
        else {
          this._deltaX = aEvent.screenX - this._window.screenX;
          this._deltaY = aEvent.screenY - this._window.screenY;
        }
        this._draggingWindow = true;
        this._window.addEventListener("mousemove", this, false);
        this._window.addEventListener("mouseup", this, false);
        break;
      case "mousemove":
        if (this._draggingWindow) {
          let toDrag = this.isPanel() ? this._elem : this._window;
          toDrag.moveTo(aEvent.screenX - this._deltaX, aEvent.screenY - this._deltaY);
        }
        break;
      case "mouseup":
        if (this._draggingWindow) {
          this._draggingWindow = false;
          this._window.removeEventListener("mousemove", this, false);
          this._window.removeEventListener("mouseup", this, false);
        }
        break;
    }
  }
}

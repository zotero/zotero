/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

{
	Services.scriptloader.loadSubScript("chrome://zotero/content/elements/base.js", this);
	const XULElementBaseMixin = MozElements.MozElementMixin(XULElementBase);
	
	class UpdateHeader extends XULElementBaseMixin {
		content = MozXULElement.parseXULToFragment(`
			<hbox class="wizard-header update-header" flex="1">
				<vbox class="wizard-header-box-1">
				  <vbox class="wizard-header-box-text">
					<label><html:h2 class="wizard-header-label"/></label>
				  </vbox>
				</vbox>
			  </hbox>
		`);
		
		connectedCallback() {
			super.connectedCallback();
			
			this.querySelector('h2').textContent = this.getAttribute('label');
		}
		
		static get observedAttributes() { return ['label']; }
		
		attributeChangedCallback(name, oldVal, newVal) {
			if (name == "label" && newVal != oldVal) {
				this.querySelector('h2').textContent = newVal;
			}
		}
	}
	
	customElements.define("update-header", UpdateHeader);
}

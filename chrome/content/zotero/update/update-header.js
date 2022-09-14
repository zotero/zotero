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
					<label class="wizard-header-label"/>
				  </vbox>
				</vbox>
			  </hbox>
		`);
		
		static get inheritedAttributes() {
			return {
				".wizard-header-label": "value=label",
			};
		}
		
		connectedCallback() {
			super.connectedCallback();
			this.initializeAttributeInheritance();
		}
	}
	
	customElements.define("update-header", UpdateHeader);
}

{
	class PreferenceControl extends XULElement {
		_input = null;

		get label() {
			return this.getAttribute('label');
		}

		set label(val) {
			this.setAttribute('label', val);
		}

		get preference() {
			return this.getAttribute('preference');
		}

		set preference(val) {
			this.setAttribute('preference', val);
		}

		get disabled() {
			return this.hasAttribute('disabled');
		}

		set disabled(val) {
			this.toggleAttribute('disabled', !!val);
		}

		/**
		 * @return {'checkbox' | 'text' | 'number'}
		 */
		get type() {
			let branch = Zotero.Prefs.rootBranch;
			switch (Zotero.Prefs.rootBranch.getPrefType(this.preference)) {
				case branch.PREF_BOOL:
					return 'checkbox';

				case branch.PREF_STRING:
					return 'text';
				
				case branch.PREF_INT:
					return 'number';

				default:
					Zotero.debug(`Preference ${this.preference} has unknown type`);
					return 'text';
			}
		}

		static get observedAttributes() {
			return ['disabled'];
		}

		attributeChangedCallback(name, oldValue, newValue) {
			if (!this.isConnected) return;

			switch (name) {
				case 'disabled':
					this._input.disabled = newValue !== null;
			}
		}

		connectedCallback() {
			let shadowRoot = this.attachShadow({ mode: 'open' });
			let input = document.createElement('input');
			this._input = input;
			let labelElem = document.createElement('label');

			let pref = this.preference;
			let type = this.type;

			input.type = type;

			if (type == 'checkbox') {
				input.checked = Zotero.Prefs.get(pref, true);
				input.addEventListener('input', () => {
					Zotero.Prefs.set(pref, input.checked, true);
				});
				labelElem.append(input, this.label);
			}
			else {
				input.value = Zotero.Prefs.get(pref, true);
				input.addEventListener('input', () => {
					Zotero.Prefs.set(pref, input.value, true);
				});
				labelElem.append(this.label, input);
			}

			shadowRoot.append(labelElem);
		}

		disconnectedCallback() {
			this.replaceChildren();
		}
	}

	customElements.define('preference-control', PreferenceControl);
}

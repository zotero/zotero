{
	class PreferencePane extends XULElement {
		connectedCallback() {
			this.attachShadow({ mode: 'open' });
		}
	}

	customElements.define('preference-pane', PreferencePane);
}

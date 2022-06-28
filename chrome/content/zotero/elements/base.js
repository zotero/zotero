class XULElementBase extends XULElement {
	/**
	 * @return {String[]} Stylesheet URIs
	 */
	get stylesheets() {
		return [];
	}

	/**
	 * @return {DocumentFragment | null}
	 */
	get content() {
		return null;
	}

	init() {}

	destroy() {}

	connectedCallback() {
		let shadow = this.attachShadow({ mode: 'open' });

		for (let href of this.stylesheets) {
			let link = document.createElement('link');
			link.rel = 'stylesheet';
			link.href = href;
			shadow.append(link);
		}

		let content = this.content;
		if (content) {
			content = document.importNode(content, true);
			shadow.append(content);
		}

		this.init();
	}

	disconnectedCallback() {
		this.replaceChildren();
		this.destroy();
	}
}

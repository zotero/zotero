{
    class HighlightButton extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
            <button class="highlight-button" style="
                background: #ffeb3b;
                border: none;
                border-radius: 4px;
                padding: 4px 8px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 4px;
                margin: 4px 0;
            ">
                <html:img src="chrome://zotero/skin/highlight-icon.svg" style="width: 14px; height: 14px;" />
                <label value="View Highlight" />
            </button>
        `);

        init() {
            this._button = this.querySelector('.highlight-button');
            this._button.addEventListener('click', () => this._handleClick());
        }

        _handleClick() {
            // Get the highlight data from the button's data attributes
            const highlightData = {
                id: this.getAttribute('data-highlight-id'),
                fileId: this.getAttribute('data-file-id'),
                position: JSON.parse(this.getAttribute('data-position') || '{}')
            };

            // Dispatch a custom event to handle the highlight navigation
            const event = new CustomEvent('highlightNavigation', {
                detail: highlightData,
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(event);
        }

        // Method to set highlight data
        setHighlightData(data) {
            this.setAttribute('data-highlight-id', data.id);
            this.setAttribute('data-file-id', data.fileId);
            this.setAttribute('data-position', JSON.stringify(data.position));
        }
    }

    customElements.define("highlight-button", HighlightButton);
}

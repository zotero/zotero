/*
   ***** BEGIN LICENSE BLOCK *****
   Copyright © 2024 Corporation for Digital Scholarship
                Vienna, Virginia, USA
                https://www.zotero.org
   This file is part of Zotero.
   Zotero is free software: you can redistribute it and/or modify
   it under the terms of the GNU Affero General Public License as published by
   the Free Software Foundation, either version 3 of the License, or
   (at your option) any later version.
   Zotero is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU Affero General Public License for more details.
   You should have received a copy of the GNU Affero General Public License
   along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
   ***** END LICENSE BLOCK *****
*/

{
    class DeepTutorButton extends XULElementBase {
        static get observedAttributes() {
            return ['label', 'selected'];
        }

        constructor() {
            super();
            this._button = null;
        }

        connectedCallback() {
            this.render();
            this.setupEventListeners();
        }

        attributeChangedCallback(name, oldValue, newValue) {
            if (name === 'label' || name === 'selected') {
                this.render();
                this.setupEventListeners();
            }
        }

        render() {
            const label = this.getAttribute('label') || '';
            const isSelected = this.getAttribute('selected') === 'true';

            this.innerHTML = `
                <button class="deep-tutor-button" style="
                    min-width: 48px;
                    background: ${isSelected ? '#e9ecef' : 'transparent'};
                    border: none;
                    border-radius: 4px;
                    padding: 2px 12px;
                    font-size: 0.95em;
                    margin-right: 2px;
                    height: 22px;
                    cursor: pointer;
                    transition: background-color 0.2s ease;
                    font-weight: ${isSelected ? '600' : 'normal'};
                ">${label}</button>
            `;
        }

        setupEventListeners() {
            // Remove old event listener if it exists
            if (this._button) {
                this._button.removeEventListener('click', this._handleClick);
            }

            // Get the new button element
            this._button = this.querySelector('.deep-tutor-button');
            if (this._button) {
                this._button.addEventListener('click', this._handleClick.bind(this));
            }
        }

        _handleClick() {
            this.dispatchEvent(new CustomEvent('command', {
                bubbles: true,
                composed: true
            }));
        }

        set selected(value) {
            if (value) {
                this.setAttribute('selected', 'true');
            } else {
                this.removeAttribute('selected');
            }
        }

        get selected() {
            return this.hasAttribute('selected');
        }
    }

    customElements.define('deep-tutor-button', DeepTutorButton);
} 
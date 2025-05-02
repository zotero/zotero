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


    class DeepTutorPane extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
           <vbox id="main-container" flex="1" style="
               padding: 16px;
               background: #f8f9fa;
               width: 100%;
               height: 100%;
               overflow: hidden;
               display: flex;
               flex-direction: column;
           ">
               <hbox id="top-bar" style="margin-bottom: 12px; gap: 8px; align-items: center; background: #e9ecef; padding: 2px 6px; border-radius: 6px; width: fit-content; height: 28px;">
                   <button id="tab1-btn" label="Tab 1" style="min-width: 48px; background: #dedede; border: none; border-radius: 4px; padding: 2px 12px; font-size: 0.95em; margin-right: 2px; height: 22px;" />
                   <button id="tab2-btn" label="Tab 2" style="min-width: 48px; background: #dedede; border: none; border-radius: 4px; padding: 2px 12px; font-size: 0.95em; margin-right: 8px; height: 22px;" />
                   <button id="add-tab-btn" label="+" style="background: none; border: none; font-size: 1em; margin-right: 4px; padding: 0 4px; min-width: 20px; height: 20px;" />
                   <button id="reload-btn" label="\u21bb" style="background: none; border: none; font-size: 1em; margin-right: 4px; padding: 0 4px; min-width: 20px; height: 20px;" />
                   <button id="close-btn" label="\u2715" style="background: none; border: none; font-size: 1em; padding: 0 4px; min-width: 20px; height: 20px;" />
               </hbox>
               <description value="DeepTutor" style="
                   font-size: 1.2em;
                   font-weight: 600;
                   color: #2c3e50;
                   margin-bottom: 16px;
                   padding-bottom: 8px;
                   border-bottom: 2px solid #e9ecef;
               " />
               <hbox id="button-container" style="
                   margin-bottom: 16px;
                   gap: 8px;
                   padding: 8px;
                   background: #fff;
                   border-radius: 8px;
                   box-shadow: 0 2px 4px rgba(0,0,0,0.1);
               ">
                   <button id="tutor-btn" class="nav-button" label="Tutor" />
                   <button id="notes-btn" class="nav-button" label="Notes" />
                   <button id="settings-btn" class="nav-button" label="Settings" />
               </hbox>
               <vbox id="content-container" flex="1" style="width: 100%; height: 100%; overflow: hidden;">
                   <deep-tutor-box id="tutor-component" style="height: 100%; width: 100%;" />
                   <deep-notes-box id="notes-component" style="height: 100%; width: 100%; display: none;" />
                   <deep-settings-box id="settings-component" style="height: 100%; width: 100%; display: none;" />
               </vbox>
           </vbox>
        `);

        init() {
            this.render();
            this.setupEventListeners();
        }

        render() {
            Zotero.debug("Deep tutor loading");
            this.initialized = true;
        }

        setupEventListeners() {
            const buttons = this.querySelectorAll('.nav-button');
            buttons.forEach(button => {
                button.addEventListener('command', () => {
                    this.switchComponent(button.id);
                });
            });
        }

        static get observedAttributes() {
			return ['collapsed'];
		}

        switchComponent(buttonId) {
            // Hide all components
            const components = this.querySelectorAll('#content-container > *');
            components.forEach(comp => {
                comp.style.display = 'none';
            });

            // Show selected component
            const componentId = buttonId.replace('-btn', '-component');
            const selectedComponent = this.querySelector(`#${componentId}`);
            if (selectedComponent) {
                selectedComponent.style.display = 'block';
            }

            // Update button styles
            const buttons = this.querySelectorAll('.nav-button');
            buttons.forEach(btn => {
                if (btn.id === buttonId) {
                    btn.style.backgroundColor = '#e9ecef';
                    btn.style.fontWeight = '600';
                } else {
                    btn.style.backgroundColor = 'transparent';
                    btn.style.fontWeight = 'normal';
                }
            });
        }
    }

    customElements.define("deep-tutor-pane", DeepTutorPane);
}

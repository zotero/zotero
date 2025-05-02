{
    class ModelSelection extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
            <vbox id="model-selection-container" style="
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: 100%;
            ">
                <!-- Model Name Section -->
                <vbox>
                    <label value="Model Name" style="font-weight: bold; margin-bottom: 4px;"/>
                    <editable-text id="model-name" style="width: 100%;"/>
                </vbox>

                <!-- Model Description Section -->
                <vbox>
                    <label value="Model Description" style="font-weight: bold; margin-bottom: 4px;"/>
                    <editable-text id="model-description" multiline="true" rows="3" style="width: 100%;"/>
                </vbox>

                <!-- Model Type Buttons -->
                <vbox>
                    <label value="Model Type" style="font-weight: bold; margin-bottom: 4px;"/>
                    <hbox style="gap: 8px;">
                        <button id="lite-btn" label="Lite" style="flex: 1;"/>
                        <button id="normal-btn" label="Normal" style="flex: 1;"/>
                        <button id="advanced-btn" label="Advanced" style="flex: 1;"/>
                    </hbox>
                </vbox>

                <!-- Model Comment Section -->
                <vbox>
                    <label value="Model Comment" style="font-weight: bold; margin-bottom: 4px;"/>
                    <editable-text id="model-comment" multiline="true" rows="3" style="width: 100%;"/>
                </vbox>
            </vbox>
        `);

        init() {
            this._modelName = this.querySelector('#model-name');
            this._modelDescription = this.querySelector('#model-description');
            this._modelComment = this.querySelector('#model-comment');
            this._liteBtn = this.querySelector('#lite-btn');
            this._normalBtn = this.querySelector('#normal-btn');
            this._advancedBtn = this.querySelector('#advanced-btn');

            // Initialize model type buttons
            this._selectedType = 'normal'; // Default selection
            this._updateButtonStyles();

            // Add click handlers for model type buttons
            this._liteBtn.addEventListener('click', () => this._handleTypeSelection('lite'));
            this._normalBtn.addEventListener('click', () => this._handleTypeSelection('normal'));
            this._advancedBtn.addEventListener('click', () => this._handleTypeSelection('advanced'));
        }

        _handleTypeSelection(type) {
            this._selectedType = type;
            this._updateButtonStyles();
        }

        _updateButtonStyles() {
            const buttons = {
                lite: this._liteBtn,
                normal: this._normalBtn,
                advanced: this._advancedBtn
            };

            // Reset all buttons
            Object.values(buttons).forEach(btn => {
                btn.style.backgroundColor = '#e0e0e0';
                btn.style.color = '#444';
            });

            // Highlight selected button
            buttons[this._selectedType].style.backgroundColor = '#2c25ac';
            buttons[this._selectedType].style.color = '#fff';
        }

        // Getters for model data
        getModelData() {
            return {
                name: this._modelName.value,
                description: this._modelDescription.value,
                type: this._selectedType,
                comment: this._modelComment.value
            };
        }

        // Setters for model data
        setModelData(data) {
            if (data.name) this._modelName.value = data.name;
            if (data.description) this._modelDescription.value = data.description;
            if (data.type) {
                this._selectedType = data.type;
                this._updateButtonStyles();
            }
            if (data.comment) this._modelComment.value = data.comment;
        }
    }
    customElements.define("model-selection", ModelSelection);
} 
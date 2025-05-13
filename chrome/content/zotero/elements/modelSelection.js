{
    class ModelSelection extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
            <vbox id="model-selection-container" style="
                display: flex;
                flex-direction: column;
                gap: 12px;
                width: 100%;
            ">
                <!-- Upload Button Section -->
                <hbox style="width: 100%; align-items: center; margin-bottom: 2px;">
                    <button id="popup-upload-btn" label="Upload" style="
                        background: #0687E5;
                        color: #000000;
                        border: none;
                        border-radius: 4px;
                        font-weight: 600;
                        padding: 4px 8px;
                        font-size: 11px;
                        cursor: pointer;
                        min-width: 0;
                        min-height: 0;
                        font-family: 'Roboto', sans-serif;
                    " />
                </hbox>

                <!-- File List Section -->
                <scrollbox id="file-list" style="
                    max-height: 100px;
                    border: 1px solid #e0e0e0;
                    border-radius: 4px;
                    background: #F8F6F7;
                    padding: 4px;
                    font-family: 'Roboto', sans-serif;
                ">
                    <vbox id="file-list-container" style="gap: 4px;"/>
                </scrollbox>

                <!-- Model Name Section -->
                <vbox>
                    <label value="Model Name" style="font-weight: bold; margin-bottom: 4px;"/>
                    <editable-text id="model-name" style="width: 100%; background: #F8F6F7; font-family: 'Roboto', sans-serif;"/>
                </vbox>

                <!-- Model Type Buttons -->
                <vbox>
                    <label value="Model Type" style="font-weight: bold; margin-bottom: 4px;"/>
                    <hbox style="gap: 8px;">
                        <button id="lite-btn" label="Lite" style="flex: 1; background: #0687E5; color: #000000; font-family: 'Roboto', sans-serif;"/>
                        <button id="normal-btn" label="Normal" style="flex: 1; background: #0687E5; color: #000000; font-family: 'Roboto', sans-serif;"/>
                        <button id="advanced-btn" label="Advanced" style="flex: 1; background: #0687E5; color: #000000; font-family: 'Roboto', sans-serif;"/>
                    </hbox>
                </vbox>

                <!-- Submit Button Section -->
                <hbox style="justify-content: center; margin-top: 16px;">
                    <button id="submit-btn" label="Submit" style="min-width: 120px; background: #0687E5; color: #000000; font-family: 'Roboto', sans-serif;"/>
                </hbox>
            </vbox>
        `);

        init() {
            this._modelName = this.querySelector('#model-name');
            this._liteBtn = this.querySelector('#lite-btn');
            this._normalBtn = this.querySelector('#normal-btn');
            this._advancedBtn = this.querySelector('#advanced-btn');
            this._submitBtn = this.querySelector('#submit-btn');
            this._popupUploadButton = this.querySelector('#popup-upload-btn');
            this._fileListContainer = this.querySelector('#file-list-container');

            // Initialize model type buttons
            this._selectedType = 'normal'; // Default selection
            this._updateButtonStyles();

            // manage file list
            this._fileList = [];
            this._originalFileList = [];

            // Add click handlers for model type buttons
            this._liteBtn.addEventListener('click', () => this._handleTypeSelection('lite'));
            this._normalBtn.addEventListener('click', () => this._handleTypeSelection('normal'));
            this._advancedBtn.addEventListener('click', () => this._handleTypeSelection('advanced'));

            // Add click handler for submit button
            this._submitBtn.addEventListener('click', () => this.RegisterSubmit());

            // Add click handler for upload button
            this._popupUploadButton.addEventListener('click', () => this._handleUpload());
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

            Object.entries(buttons).forEach(([type, btn]) => {
                if (type === this._selectedType) {
                    btn.style.backgroundColor = '#0687E5';
                    btn.style.color = '#FFFFFF';
                    btn.style.fontFamily = 'Roboto, sans-serif';
                    btn.style.fontWeight = 'bold';
                } else {
                    btn.style.backgroundColor = '#F8F6F7';
                    btn.style.color = '#000000';
                    btn.style.fontFamily = 'Roboto, sans-serif';
                    btn.style.fontWeight = 'bold';
                }
            });
        }

        _createFileButton(file) {
            const button = document.createXULElement('hbox');
            button.setAttribute('style', `
                background: #f8f9fa;
                border: 1px solid #e0e0e0;
                border-radius: 4px;
                padding: 4px 8px;
                align-items: center;
                justify-content: space-between;
                cursor: pointer;
                margin: 2px 0;
            `);

            const label = document.createXULElement('label');
            label.setAttribute('value', `File ${file.id}`);
            label.setAttribute('style', 'flex: 1; margin-right: 8px;');

            const removeButton = document.createXULElement('label');
            removeButton.setAttribute('value', '×');
            removeButton.setAttribute('style', `
                color: #dc3545;
                font-weight: bold;
                font-size: 16px;
                cursor: pointer;
                padding: 0 4px;
            `);

            button.appendChild(label);
            button.appendChild(removeButton);

            // Add click handler to remove the file
            button.addEventListener('click', () => this._removeFile(file.id));

            return button;
        }

        _updateFileList() {
            // Clear existing file list
            while (this._fileListContainer.firstChild) {
                this._fileListContainer.removeChild(this._fileListContainer.firstChild);
            }

            // Add buttons for each file
            this._fileList.forEach(file => {
                this._fileListContainer.appendChild(this._createFileButton(file));
            });
        }

        _removeFile(fileId) {
            this._fileList = this._fileList.filter(file => file.id !== fileId);
            this._updateFileList();

            // Dispatch event with updated PDF data
            const event = new CustomEvent('pdfDataUpdate', {
                detail: { pdfDataList: this._fileList },
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(event);
        }

        // Getters for model data
        getModelData() {
            return {
                fileList: this._fileList,
                name: this._modelName.value,
                type: this._selectedType,
                originalFileList: this._originalFileList
            };
        }

        // Setters for model data
        setModelData(data) {
            if (data.name) this._modelName.value = data.name;
            if (data.type) {
                this._selectedType = data.type;
                this._updateButtonStyles();
            }
        }

        RegisterSubmit() {
            const modelData = this.getModelData();
            Zotero.debug(`ModelSelection: Dispatching RegisterReq event with data: ${JSON.stringify(modelData)}`);
            const event = new CustomEvent('RegisterReq', {
                detail: modelData,
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(event);
        }

        async _handleUpload() {
            const selectedItems = ZoteroPane.getSelectedItems();
            if (!selectedItems.length) {
                Zotero.debug("No items selected");
                return;
            }

            const pdfAttachments = selectedItems.reduce((arr, item) => {
                if (item.isPDFAttachment()) {
                    return arr.concat([item]);
                }
                if (item.isRegularItem()) {
                    return arr.concat(item.getAttachments()
                        .map(x => Zotero.Items.get(x))
                        .filter(x => x.isPDFAttachment()));
                }
                return arr;
            }, []);

            if (!pdfAttachments.length) {
                Zotero.debug("No PDF attachments found in selected items");
                return;
            }
            this._originalFileList = pdfAttachments;


            // Process all PDFs concurrently using Promise.all
            const pdfProcessingPromises = pdfAttachments.map(async (pdf) => {
                try {
                    const { text } = await Zotero.PDFWorker.getFullText(pdf.id);
                    if (text) {
                        return {
                            id: pdf.id,
                            content: text.substring(0, 200)
                        };
                    }
                    return null;
                } catch (e) {
                    Zotero.debug(`Error extracting text from PDF: ${e.message}`);
                    return null;
                }
            });

            // Wait for all PDFs to be processed
            const results = await Promise.all(pdfProcessingPromises);
            
            // Filter out any null results
            const pdfDataList = results.filter(result => result !== null);
            this._fileList = pdfDataList;

            // Update the file list UI
            this._updateFileList();

            // Dispatch event with PDF data
            const event = new CustomEvent('pdfDataUpdate', {
                detail: { pdfDataList },
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(event);

            Zotero.debug(`Successfully uploaded ${pdfDataList.length} PDFs`);
        }
    }
    customElements.define("model-selection", ModelSelection);
} 
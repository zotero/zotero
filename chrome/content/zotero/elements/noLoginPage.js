{
    class NoLoginPage extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
            <vbox id="no-login-container" flex="1" style="
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                width: 100%;
                background: #fafbfc;
                font-family: 'Roboto', sans-serif;
            ">
                <hbox style="width: 100%; justify-content: flex-start; margin-bottom: 32px;">
                    <label style="font-size: 2em; font-weight: bold; color: #222; letter-spacing: -1px;">
                        DeepTut<html:span style='color:#0687E5;'>o<html:img src="chrome://zotero/skin/gear-icon.svg" style="height: 1em; vertical-align: middle; margin-left: -2px; margin-right: 2px;"/></html:span>r
                    </label>
                </hbox>
                <spacer flex="1" />
                <vbox style="align-items: center;">
                    <label style="font-size: 1.3em; font-weight: bold; color: #222; margin-bottom: 8px; text-align: center;">
                        Start Chatting with DeepTutor.
                    </label>
                    <label style="font-size: 1em; font-weight: 500; color: #222; margin-bottom: 8px; text-align: center;">
                        Sign in to read papers more <b>efficiently</b>.
                    </label>
                    <label style="font-size: 0.98em; color: #444; margin-bottom: 32px; text-align: center; max-width: 340px;">
                        ask questions, get instant explanations and summaries, and save your chat history for future reference.
                    </label>
                    <button id="sign-in-btn" style="
                        background: #0687E5;
                        color: #fff;
                        border: none;
                        border-radius: 8px;
                        font-size: 1.1em;
                        font-family: 'Roboto', sans-serif;
                        font-weight: 500;
                        padding: 10px 0;
                        width: 260px;
                        margin-bottom: 32px;
                        cursor: pointer;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.04);
                        transition: background 0.2s;
                    ">Sign in</button>
                </vbox>
                <spacer flex="2" />
                <hbox style="width: 100%; justify-content: center; align-items: flex-end; margin-bottom: 24px;">
                    <html:img src="chrome://zotero/skin/folder-icon.svg" style="height: 64px; opacity: 0.13; margin-right: 24px;"/>
                    <html:img src="chrome://zotero/skin/document-icon.svg" style="height: 64px; opacity: 0.13;"/>
                </hbox>
            </vbox>
        `);
        init() {
            // Add sign-in logic if needed
            this.querySelector('#sign-in-btn').addEventListener('click', () => {
                // Placeholder: dispatch a custom event or handle sign-in
                this.dispatchEvent(new CustomEvent('SignInClicked', { bubbles: true }));
            });
        }
    }
    customElements.define('no-login-page', NoLoginPage);
} 
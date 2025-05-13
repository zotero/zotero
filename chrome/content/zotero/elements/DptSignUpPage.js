{
    class DptSignUpPage extends XULElementBase {
        content = MozXULElement.parseXULToFragment(`
            <vbox id="signup-container" flex="1" style="
                width: 360px;
                background: #fff;
                border-radius: 12px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.10);
                padding: 32px 24px 16px 24px;
                font-family: 'Roboto', sans-serif;
                align-items: center;
            ">
                <hbox style="width: 100%; justify-content: space-between; align-items: center; margin-bottom: 18px;">
                    <label style="font-size: 1.5em; font-weight: bold; color: #0687E5; margin: 0 auto;">Sign up</label>
                    <button id="close-btn" style="background: none; border: none; font-size: 1.3em; color: #888; cursor: pointer; font-weight: bold;">&#10005;</button>
                </hbox>
                <label style="font-size: 1em; color: #222; margin-bottom: 4px; align-self: flex-start;">Name</label>
                <editable-text id="name" placeholder="Name" style="width: 100%; margin-bottom: 12px; background: #f6f6f6; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; font-size: 1em; font-family: 'Roboto', sans-serif;" />
                <label style="font-size: 1em; color: #222; margin-bottom: 4px; align-self: flex-start;">Email address</label>
                <editable-text id="email" placeholder="example@email.com" style="width: 100%; margin-bottom: 12px; background: #f6f6f6; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; font-size: 1em; font-family: 'Roboto', sans-serif;" />
                <label style="font-size: 1em; color: #222; margin-bottom: 4px; align-self: flex-start;">Password</label>
                <editable-text id="password" placeholder="Must be at least 8 characters" style="width: 100%; margin-bottom: 12px; background: #f6f6f6; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; font-size: 1em; font-family: 'Roboto', sans-serif;" type="password" />
                <label style="font-size: 1em; color: #222; margin-bottom: 4px; align-self: flex-start;">Confirm Password</label>
                <editable-text id="confirm-password" placeholder="Retype your password" style="width: 100%; margin-bottom: 18px; background: #f6f6f6; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; font-size: 1em; font-family: 'Roboto', sans-serif;" type="password" />
                <button id="signup-btn" style="
                    width: 100%;
                    background: #0687E5;
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    font-size: 1.1em;
                    font-family: 'Roboto', sans-serif;
                    font-weight: 500;
                    padding: 12px 0;
                    margin-bottom: 18px;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.04);
                    transition: background 0.2s;
                ">Sign up</button>
                <hbox style="width: 100%; align-items: center; margin: 12px 0 12px 0;">
                    <hr style="flex: 1; border: none; border-top: 1px solid #e0e0e0; margin-right: 8px;" />
                    <label style="color: #888; font-size: 1em;">or</label>
                    <hr style="flex: 1; border: none; border-top: 1px solid #e0e0e0; margin-left: 8px;" />
                </hbox>
                <button id="google-btn" style="
                    width: 100%;
                    background: #fff;
                    color: #222;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    font-size: 1.05em;
                    font-family: 'Roboto', sans-serif;
                    font-weight: 500;
                    padding: 10px 0;
                    margin-bottom: 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                "><html:img src="chrome://zotero/skin/google-logo.svg" style="height: 20px; margin-right: 8px;"/>Sign up with Google</button>
                <hbox style="width: 100%; justify-content: center; margin-top: 8px;">
                    <label style="color: #888; font-size: 0.98em;">Already have an account? </label>
                    <label id="signin-link" style="color: #0687E5; font-size: 0.98em; margin-left: 4px; cursor: pointer; text-decoration: underline;">Sign in here</label>
                </hbox>
            </vbox>
        `);
        init() {
            this.querySelector('#close-btn').addEventListener('click', () => {
                this.dispatchEvent(new CustomEvent('CloseSignUp', { bubbles: true }));
            });
        }
    }
    customElements.define('dpt-signup-page', DptSignUpPage);
} 
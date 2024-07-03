var EXPORTED_SYMBOLS = ["TranslationParent", "TranslationManager"];

var { Zotero } = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");

const TranslationManager = new class {
	_registeredRemoteTranslates = new Map();
	
	add(id, remoteTranslate) {
		this._registeredRemoteTranslates.set(id, {
			remoteTranslate,
			translatorProvider: null,
			handlers: {},
		});
	}
	
	remove(id) {
		this._registeredRemoteTranslates.delete(id);
	}
	
	getTranslatorProvider(id) {
		return this._registeredRemoteTranslates.get(id).translatorProvider;
	}
	
	setTranslatorProvider(id, provider) {
		this._registeredRemoteTranslates.get(id).translatorProvider = provider;
	}
	
	setHandler(id, name, handler) {
		if (this._registeredRemoteTranslates.get(id).handlers[name]) {
			this._registeredRemoteTranslates.get(id).handlers[name] = [
				...this._registeredRemoteTranslates.get(id).handlers[name],
				handler
			];
		}
		else {
			this._registeredRemoteTranslates.get(id).handlers[name] = [handler];
		}
	}
	
	removeHandler(id, name, handler) {
		this._registeredRemoteTranslates.get(id).handlers[name]
			= this._registeredRemoteTranslates.get(id).handlers[name]?.filter(h => h !== handler);
	}

	clearHandlers(id, name) {
		this._registeredRemoteTranslates.get(id).handlers[name] = null;
	}

	async runHandler(id, name, ...args) {
		let remoteTranslate = this._registeredRemoteTranslates.get(id).remoteTranslate;
		let handlers = this._registeredRemoteTranslates.get(id).handlers[name];
		let returnValue = null;
		if (handlers) {
			for (let handler of handlers) {
				try {
					returnValue = await handler(remoteTranslate, ...args);
				}
				catch (e) {
					Zotero.logError(e);
				}
			}
		}
		return returnValue;
	}
};

class TranslationParent extends JSWindowActorParent {
	async receiveMessage(message) {
		let { name, data } = message;
		switch (name) {
			case 'Translators:call': {
				let { id, method, args } = data;
				let provider = TranslationManager.getTranslatorProvider(id) || Zotero.Translators;
				return provider[method](...args);
			}
			
			case 'Translate:runHandler': {
				let { id, name, arg } = data;
				return TranslationManager.runHandler(id, name, arg);
			}
		}
	}
}

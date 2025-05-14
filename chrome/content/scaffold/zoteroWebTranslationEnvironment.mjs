import { AbstractWebTranslationEnvironment } from 'chrome://zotero/content/xpcom/translate/testTranslators/translatorTester.mjs';

export class ZoteroWebTranslationEnvironment extends AbstractWebTranslationEnvironment {

	/**
	 * @param {string} url
	 * @param {TranslatorTester} tester
	 * @returns {Promise<HiddenBrowser>}
	 */
	async fetchPage(url, { tester }) {
		const { HiddenBrowser } = ChromeUtils.import('chrome://zotero/content/HiddenBrowser.jsm');
		let browser = new HiddenBrowser({
			docShell: { allowMetaRedirects: true },
			cookieSandbox: tester.cookieSandbox,
		});

		await browser.load(url, { requireSuccessfulStatus: true });
		return browser;
	}

	/**
	 * @param {HiddenBrowser} browser
	 * @param {TranslatorTester} tester
	 * @returns {Promise<false>} False for now, because we aren't sure that
	 * 		detection would work without the defer delay.
	 */
	async waitForLoad(browser, { tester }) {
		return false;
	}

	/**
	 * @param {HiddenBrowser} browser
	 * @param {TranslatorTester} tester
	 * @param {Record<string, Function>} handlers
	 * @param {AbortSignal} signal
	 * @returns {Promise<{
	 *     detectedItemType?: string;
	 *     items?: Zotero.Item[];
	 *     reason?: string;
	 * }>}
	 */
	async runTranslation(browser, { tester, handlers, signal }) {
		const { RemoteTranslate } = ChromeUtils.import('chrome://zotero/content/RemoteTranslate.jsm');

		let translate = new RemoteTranslate({ disableErrorReporting: true });
		try {
			await translate.setBrowser(browser);
			await translate.setTranslatorProvider(tester.translatorProvider);
			translate.setTranslator(tester.translator);
			for (let [type, fn] of Object.entries(handlers)) {
				translate.setHandler(type, fn);
			}

			let detectedTranslators = await translate.detect();
			if (!detectedTranslators.length) {
				return { items: null, reason: 'Detection failed' };
			}

			let detectedItemType = detectedTranslators[0].itemType;
			let items = await translate.translate({ libraryID: false });
			return { detectedItemType, items };
		}
		catch (e) {
			return { items: null, reason: 'Translation failed: ' + e };
		}
		finally {
			translate.dispose();
		}
	}

	/**
	 * @param {HiddenBrowser} browser
	 */
	destroy(browser) {
		browser.destroy();
	}
}

/*
	***** BEGIN LICENSE BLOCK *****

	Copyright © 2024 Corporation for Digital Scholarship
					 Vienna, Virginia, USA
					 https://digitalscholar.org

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

import { unpaywallSource } from "./openAccessSources/unpaywall.mjs";
import { arxivSource } from "./openAccessSources/arxiv.mjs";
import { pubmedCentralSource } from "./openAccessSources/pubmedcentral.mjs";

/**
 * Orchestrates open-access document resolution across multiple sources.
 * Plugins can register custom sources via the PluginAPI.
 */
Zotero.DocumentResolver = new function () {
	const lazy = {};
	ChromeUtils.defineESModuleGetters(lazy, {
		Zotero: "chrome://zotero/content/zotero.mjs",
	});

	// Built-in sources
	let _sources = [
		unpaywallSource,
		pubmedCentralSource,
		arxivSource,
	];

	let _customSources = new Map(); // pluginID -> source

	/**
	 * Initialize the document resolver
	 */
	this.init = async function () {
		lazy.Zotero.debug("DocumentResolver initialized with " + _sources.length + " sources");
	};

	/**
	 * Find an open-access PDF for an item by querying all enabled sources
	 * in priority order.
	 *
	 * @param {Zotero.Item} item
	 * @param {Object} [options]
	 * @param {string[]} [options.sourceIDs] - Only search these sources
	 * @param {boolean} [options.skipDisabled] - Skip disabled sources (default: true)
	 * @return {Promise<Object|null>} - { url: string, sourceID: string } or null
	 */
	this.findDocument = async function (item, options = {}) {
		const skipDisabled = options.skipDisabled !== false;
		let sources = _sources.concat(Array.from(_customSources.values()));

		if (options.sourceIDs) {
			sources = sources.filter(s => options.sourceIDs.includes(s.id));
		}

		// Sort by priority (higher first)
		sources.sort((a, b) => b.priority - a.priority);

		for (let source of sources) {
			if (skipDisabled && !source.enabled) {
				continue;
			}

			try {
				const configured = await source.isConfigured();
				if (!configured) {
					lazy.Zotero.debug(`DocumentResolver: Skipping ${source.id} (not configured)`);
					continue;
				}

				const url = await source.findPDF(item);
				if (url) {
					lazy.Zotero.debug(`DocumentResolver: Found PDF from ${source.id}`);
					return {
						url,
						sourceID: source.id,
						sourceName: source.name,
					};
				}
			}
			catch (e) {
				lazy.Zotero.debug(`DocumentResolver error in ${source.id}: ${e.message}`);
			}
		}

		return null;
	};

	/**
	 * Get all registered sources (built-in and custom)
	 * @return {Object[]}
	 */
	this.getSources = function () {
		return _sources.concat(Array.from(_customSources.values()))
			.map(s => ({
				id: s.id,
				name: s.name,
				description: s.description,
				enabled: s.enabled,
				priority: s.priority,
				isCustom: _customSources.has(s.id),
				requiresAuth: s.requiresAuth(),
			}));
	};

	/**
	 * Enable/disable a source
	 * @param {string} sourceID
	 * @param {boolean} enabled
	 */
	this.setSourceEnabled = function (sourceID, enabled) {
		const source = _sources.find(s => s.id === sourceID) ||
			_customSources.get(sourceID);
		if (source) {
			source.enabled = enabled;
		}
	};

	/**
	 * Register a custom source (from plugin)
	 * @param {OpenAccessSourceBase} source
	 * @param {string} pluginID
	 */
	this.registerSource = function (source, pluginID) {
		if (!source.id || !source.name) {
			throw new Error("Source must have id and name properties");
		}
		source.pluginID = pluginID;
		_customSources.set(source.id, source);
		lazy.Zotero.debug(`DocumentResolver: Registered custom source ${source.id} from ${pluginID}`);
	};

	/**
	 * Unregister a custom source
	 * @param {string} sourceID
	 */
	this.unregisterSource = function (sourceID) {
		if (_customSources.has(sourceID)) {
			_customSources.delete(sourceID);
			lazy.Zotero.debug(`DocumentResolver: Unregistered source ${sourceID}`);
		}
	};

	/**
	 * Get a source by ID
	 * @param {string} sourceID
	 * @return {Object|null}
	 */
	this.getSource = function (sourceID) {
		return _sources.find(s => s.id === sourceID) || _customSources.get(sourceID) || null;
	};

	/**
	 * Download and attach a document to an item
	 * @param {Zotero.Item} item - The parent item
	 * @param {string} url - URL to the PDF
	 * @param {Object} [options]
	 * @param {string} [options.title] - Attachment title (default: item title)
	 * @return {Promise<Zotero.Item>} - The created attachment item
	 */
	this.downloadAndAttach = async function (item, url, options = {}) {
		if (!item.id) {
			throw new Error("Item must be saved before attaching files");
		}

		const title = options.title || item.getField('title') || 'PDF';

		// Download to temp file
		const tempFile = await lazy.Zotero.File.createTempFile({
			suffix: '.pdf',
		});

		try {
			await lazy.Zotero.Attachments.downloadFile(url, tempFile.path, {
				timeout: 30000,
			});

			// Import attachment
			const attachment = await lazy.Zotero.Attachments.importFromFile({
				file: tempFile,
				parentItemID: item.id,
				title: title,
			});

			return attachment;
		}
		catch (e) {
			lazy.Zotero.debug(`Error downloading document: ${e.message}`);
			throw e;
		}
		finally {
			try {
				await lazy.Zotero.File.remove(tempFile.path, { ignoreAbsent: true });
			}
			catch (e) {
				// Ignore cleanup errors
			}
		}
	};

	/**
	 * Find and attach an open-access document to an item
	 * Combines findDocument() and downloadAndAttach()
	 *
	 * @param {Zotero.Item} item
	 * @param {Object} [options]
	 * @return {Promise<Zotero.Item|null>} - The attachment item, or null if not found
	 */
	this.findAndAttach = async function (item, options = {}) {
		if (!item.id) {
			throw new Error("Item must be saved");
		}

		// Skip if already has PDF attachment
		if (await this._hasPDFAttachment(item)) {
			lazy.Zotero.debug("Item already has PDF attachment, skipping");
			return null;
		}

		const result = await this.findDocument(item, options);
		if (!result) {
			return null;
		}

		try {
			const attachment = await this.downloadAndAttach(item, result.url, {
				title: `PDF (${result.sourceName})`,
			});
			return attachment;
		}
		catch (e) {
			lazy.Zotero.debug(`Failed to attach document: ${e.message}`);
			return null;
		}
	};

	/**
	 * Check if item already has a PDF attachment
	 * @param {Zotero.Item} item
	 * @return {Promise<boolean>}
	 */
	this._hasPDFAttachment = async function (item) {
		const attachments = item.getAttachments();
		for (let attachmentID of attachments) {
			const attachment = await lazy.Zotero.Items.getAsync(attachmentID);
			if (attachment && attachment.attachmentContentType === 'application/pdf') {
				return true;
			}
		}
		return false;
	};
};

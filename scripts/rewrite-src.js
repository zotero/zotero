const globby = require('globby');
const path = require('path');
const fs = require('fs-extra');
const { getSignatures, writeSignatures, cleanUp, compareSignatures, getFileSignature, onSuccess, onError, onProgress } = require('./utils');
const { rewriteSrcFiles } = require('./config');

// eslint-disable-next-line multiline-ternary
const platform = process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'win' : 'unix';
const ROOT = path.resolve(__dirname, '..');

function getAbsolutePath(relPath, fromPath) {
	if (relPath.endsWith('overlay.css')) { //TODO
		return false;
	}
	if (relPath.startsWith('chrome://zotero/content/')) {
		return path.join(ROOT, 'build', 'chrome', 'content', 'zotero', relPath.slice(24));
	}
	else if (relPath.startsWith('chrome://zotero/locale/')) {
		return path.join(ROOT, 'build', 'chrome', 'locale', relPath.slice(23));
	}
	else if (relPath.startsWith('chrome://zotero-platform/content/')) {
		return path.join(ROOT, 'build', 'chrome', 'content', 'zotero-platform', platform, relPath.slice(33));
	}
	else if (relPath.startsWith('chrome://zotero-platform-version/content')) {
		return path.join(ROOT, 'build', 'chrome', 'content', 'zotero-platform', 'default-version', relPath.slice(40));
	}
	else if (relPath.startsWith('chrome://zotero/skin/')) {
		return path.join(ROOT, 'build', 'chrome', 'skin', 'default', 'zotero', relPath.slice(21));
	}
	else if (relPath.startsWith('chrome://global/')) {
		// ignore
		return false;
	}
	else if (relPath.startsWith('chrome://')) {
		console.log('WARNING: unmaped chrome path', relPath);
		return false;
	}
	else if (relPath.startsWith('resource://')) {
		return path.join(ROOT, 'build', 'resource', relPath.slice(11));
	}
	else {
		const newPath = path.join(fromPath, relPath);

		if (newPath.startsWith('chrome/content/zotero/')) {
			return path.join(ROOT, 'build', 'chrome', 'content', 'zotero', newPath.slice(22));
		}
		else {
			console.log('WARNING: unmaped relative path', newPath);
			return false;
		}
	}
}

function getRewrittenContent(content, fromPath) {
	content = content.replace(/<script(?:.*?)src="(.*?)"(?:.*?)>(?:<\/script>)?/ig, (match, relPath) => {
		const newPath = getAbsolutePath(relPath, fromPath);
		return newPath
			? `<script>Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader).loadSubScriptWithOptions("file://${newPath}", { ignoreCache: true });</script>`
			: match;
	});

	content = content.replace(/<\?xml-stylesheet(.*?)href="(.*?)"/ig, (match, p1, relPath) => {
		const newPath = getAbsolutePath(relPath, fromPath);
		return newPath
			? `<?xml-stylesheet${p1}href="file://${newPath}"`
			: match;
	});

	content = content.replace(/url\(["']?chrome:\/\/(.*?)["']?\)/ig, (match, relPath) => {
		const newPath = getAbsolutePath(`chrome://${relPath}`, fromPath);
		return newPath
			? `url("file://${newPath}")`
			: match;
	});

	return content;
}

async function getRewriteSrc(source, options, signatures) {
	const t1 = Date.now();
	const files = await globby(source, Object.assign({ cwd: ROOT }, options));
	const selectOptions = files
		.filter(f => f.startsWith('chrome/content/zotero/'))
		.map((f) => {
			const relF = f.slice(22); // remove chrome/content/zotero prefix
			return `<menuitem value="${relF}" label="${relF}"/>`;
			// return `<html:option value="${relF}"${relF === 'zoteroPane.xhtml' ? ' selected="selected"' : ''}>${relF}</html:option>`;
		});
	const totalCount = files.length;
	const outFiles = [];
	var f;

	while ((f = files.pop())) {
		let newFileSignature = await getFileSignature(f); // eslint-disable-line no-await-in-loop
		const dest = path.join('build', f);

		if (f in signatures) {
			if (compareSignatures(newFileSignature, signatures[f])) {
				try {
					await fs.access(dest, fs.constants.F_OK); // eslint-disable-line no-await-in-loop
					continue;
				}
				catch (_) {
					// file does not exists in build, rebuild
				}
			}
		}
		try {
			await fs.mkdirp(path.dirname(dest)); // eslint-disable-line no-await-in-loop
			const content = await fs.readFile(f, 'utf8'); // eslint-disable-line no-await-in-loop
			let newContent = getRewrittenContent(content, path.dirname(f));
			if (f === 'chrome/content/zotero/devHelper.xhtml') {
				newContent = newContent.replace('{%OPTIONS%}', selectOptions.join(''));
			}
			await fs.writeFile(dest, newContent); // eslint-disable-line no-await-in-loop
			onProgress(f, dest, 'rewrite-src');
			signatures[f] = newFileSignature;
			outFiles.push(dest);
		}
		catch (err) {
			throw new Error(`Failed on ${f}: ${err}`);
		}
	}
	
	const t2 = Date.now();
	return {
		action: 'rewrite-src',
		count: outFiles.length,
		outFiles,
		totalCount,
		processingTime: t2 - t1
	};
}

module.exports = getRewriteSrc;

if (require.main === module) {
	(async () => {
		try {
			const signatures = await getSignatures();
			onSuccess(await getRewriteSrc(rewriteSrcFiles, {}, signatures));
			onSuccess(await cleanUp(signatures));
			await writeSignatures(signatures);
		}
		catch (err) {
			process.exitCode = 1;
			global.isError = true;
			onError(err);
		}
	})();
}

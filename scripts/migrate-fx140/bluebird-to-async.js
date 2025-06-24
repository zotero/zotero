const _path = require("path");
const { warnForPath } = require(_path.resolve(__dirname, "./utils.js"));

let j;

module.exports = function (fileInfo, api) {
	({ j } = api);
	const root = j(fileInfo.source);
	doTranslate(fileInfo.path, root);
	return root.toSource({ useTabs: true, lineTerminator: "\n" });
};

module.exports.doTranslate = doTranslate;

function doTranslate(inputFile, root) {
	// Rewrite .coroutine()/.method() generators to async,
	// and replace yields with awaits
	root.find(j.CallExpression)
		.filter(path => isStaticPromiseMethodCall(path, ['coroutine', 'method']))
		.replaceWith(path => {
			let arg = path.node.arguments.at(-1);
			if (arg.type === 'CallExpression'
					&& arg.callee.type === 'MemberExpression'
					&& arg.callee.property.type === 'Identifier'
					&& arg.callee.property.name === 'bind') {
				rewriteGeneratorToAsync(arg.callee.object);
			}
			else {
				rewriteGeneratorToAsync(arg);
			}
			return arg;
		});
	
	// Rewrite Zotero.Promise.*() -> Promise.*(), for methods directly available
	// on the ES Promise class
	root.find(j.CallExpression)
		.filter(path => isStaticPromiseMethodCall(path, [
			'all',
			'race',
			'reject',
			'resolve',
		]))
		.forEach(path => {
			let callee = path.node.callee;
			callee.object = callee.object.property;
		});

	// Warn about Zotero.Promise.*() methods that we won't polyfill
	root.find(j.CallExpression)
		.filter(path => isStaticPromiseMethodCall(path, name => !['delay', 'defer'].includes(name)))
		.forEach(path => {
			warnAndAddComment(inputFile, path, `replace call to Zotero.Promise.${path.node.callee.property.name}()`);
		});

	// Warn about calls to #isResolved() and #cancel()
	root.find(j.CallExpression)
		.filter(path => isInstanceMethodCall(path, (name, objectName) => {
			return name === 'isResolved'
				|| objectName.toLowerCase().includes('promise') && name === 'cancel';
		}))
		.forEach((path) => {
			warnAndAddComment(inputFile, path, `replace call to Zotero.Promise instance method '${path.node.callee.property.name}()'`);
		});
}

function isGeneratorFunction(node) {
	return node.type === 'FunctionExpression' && node.generator;
}

function getContainingGenerator(path) {
	while (path) {
		if (isGeneratorFunction(path.node)) {
			return path.node;
		}
		path = path.parentPath;
	}
}

function isStaticPromiseMethodCall(path, methodFilter) {
	let callee = path.node.callee;
	return callee.type === 'MemberExpression'
		&& callee.object.type === 'MemberExpression'

		&& (
			callee.object.object.type === 'Identifier'
			&& callee.object.object.name === 'Zotero'
		)

		&& (
			callee.object.property.type === 'Identifier'
			&& callee.object.property.name === 'Promise'
		)

		&& (
			callee.property.type === 'Identifier'
			&& (
				Array.isArray(methodFilter)
					? methodFilter.includes(callee.property.name)
					: methodFilter(callee.property.name)
			)
		);
}

function isInstanceMethodCall(path, methodFilter) {
	let callee = path.node.callee;
	return callee.type === 'MemberExpression'
		&& callee.property.type === 'Identifier'
		&& (
			Array.isArray(methodFilter)
				? methodFilter.includes(callee.property.name)
				: methodFilter(
					callee.property.name,
					callee.object.type === 'Identifier'
						// objectName.methodName()
						// ^^^^^^^^^^
						? callee.object.name
						// varName.subObjectName.method()
						//         ^^^^^^^^^^^^^
						: callee.object.type === 'MemberExpression' && callee.object.property.type === 'Identifier'
							? callee.object.property.name
							: ''
				)
		);
}

function rewriteGeneratorToAsync(node) {
	if (!isGeneratorFunction(node)) {
		return;
	}

	node.generator = false;
	node.async = true;

	j(node.body).find(j.YieldExpression)
		.replaceWith((path) => {
			// If we aren't inside a nested generator function,
			// rewrite yield to await
			if (!getContainingGenerator(path)) {
				return ({
					...path.node,
					type: 'AwaitExpression'
				});
			}
			return path.node;
		});
}

function warnAndAddComment(inputFile, path, message) {
	if (!path.node.comments) path.node.comments = [];
	path.node.comments.push(j.commentLine(` FIXME: fx140: ${message}`))
	warnForPath(inputFile, path, message);
}

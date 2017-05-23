const path = require('path');
const gutil = require('gulp-util');
const through = require('through2');
const PluginError = gutil.PluginError;

const PLUGIN_NAME = 'gulp-react-patcher';

module.exports = function() {
	return through.obj(function(file, enc, callback) {
		if (file.isNull()) {
			this.push(file);
			return callback();
		}

		if(file.isStream()) {
			this.emit('error', new PluginError(PLUGIN_NAME, 'Streams are not supported!'));
			return callback();
		}

		try {

			let filename = path.basename(file.path);

			if(filename === 'react-dom.js') {
				file.contents = Buffer.from(file.contents.toString().replace(/ownerDocument\.createElement\((.*?)\)/gi, 'ownerDocument.createElementNS(DOMNamespaces.html, $1)'), enc);
			}
		} catch(e) {
			this.emit('error', new PluginError(PLUGIN_NAME, e));
		}

		this.push(file);
		callback();
	});
};

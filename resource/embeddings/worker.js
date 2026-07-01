/* eslint-env worker */

// Embeddings worker: runs transformers.js + ONNX Runtime (both bundled into
// transformers.js by esbuild) off the main thread. Model files and the ORT
// wasm binary are supplied by the main thread (read from the Zotero data
// directory and bundled resources respectively), so this runs in a plain
// worker context with no privileged APIs and no network access.

import { env, pipeline } from './transformers.js';

// Map<relativePath, ArrayBuffer> of the model's files, set on init
let modelFiles = null;
let extractor = null;
// Pooling strategy for the active model ('mean' for e5, 'cls' for bge), set on init
let pooling = 'mean';

// Configure transformers.js to load everything from our in-memory file map
// rather than the network or local disk.
//
// getModelFile() throws if BOTH allowLocalModels and allowRemoteModels are
// false, so at least one must be true. We enable local and disable remote:
// the custom cache (below) serves every file, so it always hits; but on a
// cache miss this combination degrades to a harmless local-path read+warning
// instead of an actual network fetch to remoteHost. Keep it this way to stay
// fully offline.
env.allowRemoteModels = false;
env.allowLocalModels = true;
env.useBrowserCache = false;
env.useCustomCache = true;
// transformers.js asks the cache for the local path ("NO_LOCAL/...", which we
// reject) and then the remote-style URL. The cache HITS on that remote URL, so
// remoteHost/remotePathTemplate are load-bearing -- they build the lookup key,
// not a real address. localModelPath is a sentinel so the local lookup is a
// no-op we reject in match().
env.localModelPath = 'NO_LOCAL';
env.remoteHost = 'https://local.invalid/';
env.remotePathTemplate = '{model}/{revision}';
env.customCache = {
	async match(key) {
		if (typeof key !== 'string' || key.startsWith('NO_LOCAL')) {
			return null;
		}
		// `key` is a URL ending in the file's relative path. Match on a leading
		// "/" so the path segment is exact -- otherwise "config.json" would also
		// match a request for "tokenizer_config.json" (a suffix collision that
		// silently served the wrong file and broke batch tokenization/padding).
		for (let [rel, buffer] of modelFiles) {
			if (key.endsWith('/' + rel)) {
				return new Response(buffer, {
					headers: {
						'Content-Type': 'application/octet-stream',
						'Content-Length': String(buffer.byteLength)
					}
				});
			}
		}
		return null;
	},
	async put() {
		// Read-only cache; nothing to store
	}
};

async function init({ modelId, dtype, pooling: poolingArg, files, wasmPaths, wasmBinary }) {
	modelFiles = new Map(files);
	pooling = poolingArg || 'mean';
	// Single-threaded CPU wasm. We're already in a worker, so disable ORT's
	// own proxy worker. numThreads=1 avoids the SharedArrayBuffer/pthreads path.
	env.backends.onnx.wasm.numThreads = 1;
	env.backends.onnx.wasm.proxy = false;
	env.backends.onnx.wasm.wasmPaths = wasmPaths;
	if (wasmBinary) {
		env.backends.onnx.wasm.wasmBinary = wasmBinary;
	}
	// Force the CPU wasm backend explicitly; without a device, transformers.js
	// may try the JSEP/WebGPU path and fail during session init.
	extractor = await pipeline('feature-extraction', modelId, { dtype, device: 'wasm' });
	return { ready: true };
}

async function embed({ texts }) {
	if (!extractor) {
		throw new Error('Embeddings worker not initialized');
	}
	let output = await extractor(texts, { pooling, normalize: true });
	// output is a Tensor: { data: Float32Array, dims: [batch, dim] }. Transfer
	// the underlying buffer back to the main thread to avoid a copy.
	return { dims: output.dims, data: output.data };
}

const HANDLERS = { init, embed };

async function handleMessage(event) {
	let { id, action, data } = event.data;
	try {
		let handler = HANDLERS[action];
		if (!handler) {
			throw new Error(`Unknown action: ${action}`);
		}
		let result = await handler(data);
		// Transfer any ArrayBuffer in the result back without copying
		let transfer = [];
		if (result && result.data && result.data.buffer) {
			transfer.push(result.data.buffer);
		}
		self.postMessage({ id, result }, transfer);
	}
	catch (e) {
		self.postMessage({
			id,
			error: {
				message: e?.message || String(e),
				name: e?.name,
				stack: e?.stack
			}
		});
	}
}

// Handle requests strictly one at a time.
let requestChain = Promise.resolve();

self.addEventListener('message', (event) => {
	requestChain = requestChain.then(() => handleMessage(event));
});

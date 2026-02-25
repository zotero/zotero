/*
	***** BEGIN LICENSE BLOCK *****

	Screenshot Explainer for Zotero
	Captures a screen region and explains it using the Anthropic Claude Vision API.

	***** END LICENSE BLOCK *****
*/

'use strict';

var Zotero_Screenshot_Explainer = {
	_overlay: null,

	/**
	 * Entry point -- triggered by the toolbar button.
	 * Checks for an API key, then shows the drag-to-select overlay.
	 */
	startCapture() {
		let apiKey = '';
		try {
			apiKey = Zotero.Prefs.get('anthropic.apiKey');
		}
		catch (e) {}

		if (!apiKey) {
			Services.prompt.alert(
				window,
				'Screenshot Explainer',
				'Please set your Anthropic API key in Edit \u2192 Settings \u2192 API Keys.'
			);
			return;
		}

		if (this._overlay) {
			// Already active -- cancel current overlay
			this._cancelOverlay();
			return;
		}

		this._showSelectionOverlay();
	},

	_cancelOverlay() {
		if (this._overlay) {
			this._overlay.remove();
			this._overlay = null;
		}
	},

	// -------------------------------------------------------------------------
	// Selection overlay
	// -------------------------------------------------------------------------

	_showSelectionOverlay() {
		let doc = document;

		let overlay = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		overlay.id = 'zotero-screenshot-overlay';
		Object.assign(overlay.style, {
			position: 'fixed',
			inset: '0',
			zIndex: '99998',
			cursor: 'crosshair',
			userSelect: 'none',
		});

		// Instruction badge
		let badge = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		Object.assign(badge.style, {
			position: 'absolute',
			top: '12px',
			left: '50%',
			transform: 'translateX(-50%)',
			background: 'rgba(0,0,0,0.72)',
			color: '#fff',
			padding: '7px 18px',
			borderRadius: '20px',
			fontSize: '13px',
			fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
			fontWeight: '500',
			pointerEvents: 'none',
			whiteSpace: 'nowrap',
			boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
		});
		badge.textContent = 'Drag to select an area \u2014 Esc to cancel';
		overlay.appendChild(badge);

		// Four dark mask quadrants that surround the live selection
		let masks = [];
		for (let i = 0; i < 4; i++) {
			let m = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
			Object.assign(m.style, {
				position: 'absolute',
				background: 'rgba(0,0,0,0.38)',
				pointerEvents: 'none',
			});
			masks.push(m);
			overlay.appendChild(m);
		}
		// Initially fill the whole screen
		Object.assign(masks[0].style, { inset: '0' });
		masks[1].style.display = 'none';
		masks[2].style.display = 'none';
		masks[3].style.display = 'none';

		// Selection rectangle (border only)
		let selBox = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		Object.assign(selBox.style, {
			position: 'absolute',
			border: '2px solid #1a73e8',
			boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
			boxSizing: 'border-box',
			display: 'none',
			pointerEvents: 'none',
		});
		overlay.appendChild(selBox);

		// ---- drag state ----
		let startX = 0, startY = 0, isDragging = false;

		let updateLayout = (x, y, w, h) => {
			let ww = window.innerWidth;
			let wh = window.innerHeight;
			// top strip
			Object.assign(masks[0].style, { left: '0', top: '0', width: ww + 'px', height: y + 'px', display: '' });
			// bottom strip
			Object.assign(masks[1].style, { left: '0', top: (y + h) + 'px', width: ww + 'px', height: Math.max(0, wh - y - h) + 'px', display: '' });
			// left strip
			Object.assign(masks[2].style, { left: '0', top: y + 'px', width: x + 'px', height: h + 'px', display: '' });
			// right strip
			Object.assign(masks[3].style, { left: (x + w) + 'px', top: y + 'px', width: Math.max(0, ww - x - w) + 'px', height: h + 'px', display: '' });

			Object.assign(selBox.style, {
				left: x + 'px',
				top: y + 'px',
				width: w + 'px',
				height: h + 'px',
				display: '',
			});
		};

		let onMouseDown = (e) => {
			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;
			updateLayout(startX, startY, 0, 0);
			e.preventDefault();
			e.stopPropagation();
		};

		let onMouseMove = (e) => {
			if (!isDragging) return;
			let x = Math.min(e.clientX, startX);
			let y = Math.min(e.clientY, startY);
			let w = Math.abs(e.clientX - startX);
			let h = Math.abs(e.clientY - startY);
			updateLayout(x, y, w, h);
			e.preventDefault();
		};

		let cleanup = () => {
			overlay.removeEventListener('mousedown', onMouseDown);
			overlay.removeEventListener('mousemove', onMouseMove);
			overlay.removeEventListener('mouseup', onMouseUp);
			document.removeEventListener('keydown', onKeyDown, true);
			overlay.remove();
			this._overlay = null;
		};

		let onMouseUp = async (e) => {
			if (!isDragging) return;
			isDragging = false;

			let x = Math.min(e.clientX, startX);
			let y = Math.min(e.clientY, startY);
			let w = Math.abs(e.clientX - startX);
			let h = Math.abs(e.clientY - startY);

			cleanup();

			if (w > 10 && h > 10) {
				await this._captureAndExplain(x, y, w, h);
			}
		};

		let onKeyDown = (e) => {
			if (e.key === 'Escape') {
				cleanup();
				e.preventDefault();
				e.stopPropagation();
			}
		};

		overlay.addEventListener('mousedown', onMouseDown);
		overlay.addEventListener('mousemove', onMouseMove);
		overlay.addEventListener('mouseup', onMouseUp);
		document.addEventListener('keydown', onKeyDown, true);

		document.documentElement.appendChild(overlay);
		this._overlay = overlay;
	},

	// -------------------------------------------------------------------------
	// Screenshot capture
	// -------------------------------------------------------------------------

	async _captureAndExplain(x, y, w, h) {
		// Brief pause so the overlay has been removed from the rendered tree
		await new Promise(resolve => setTimeout(resolve, 60));

		let dpr = window.devicePixelRatio || 1;
		let canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		let ctx = canvas.getContext('2d');

		// drawWindow is a privileged Gecko API available in chrome (XUL) context
		try {
			ctx.scale(dpr, dpr);
			ctx.drawWindow(window, x, y, w, h, '#fff');
		}
		catch (err) {
			Zotero.logError('Screenshot Explainer: drawWindow failed -- ' + err);
			this._showToast('Could not capture screenshot. Please try again.', true);
			return;
		}

		let imageDataURL = canvas.toDataURL('image/png');

		let panel = this._createExplanationPanel();
		await this._callClaude(imageDataURL, panel);
	},

	// -------------------------------------------------------------------------
	// Explanation panel (fixed height, chat input, conversation state)
	// -------------------------------------------------------------------------

	_EXPLANATION_PROMPT: 'You are explaining content from a screenshot for research. '
		+ 'Respond only in Markdown. Use LaTeX for all mathematics: inline math with \\( ... \\) and display math with \\[ ... \\]. '
		+ 'Be precise and suitable for academic use. Explain formulas and notation clearly.',

	_createExplanationPanel() {
		// Remove any previous panel
		let old = document.getElementById('zotero-explanation-panel');
		if (old) old.remove();

		let doc = document;

		let panel = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		panel.id = 'zotero-explanation-panel';
		Object.assign(panel.style, {
			position: 'fixed',
			bottom: '20px',
			right: '20px',
			width: '520px',
			height: '560px',
			maxHeight: '85vh',
			background: '#1c1c2e',
			color: '#dde1f0',
			borderRadius: '12px',
			boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08)',
			zIndex: '99999',
			display: 'flex',
			flexDirection: 'column',
			fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
			fontSize: '14px',
			overflow: 'hidden',
		});

		// ---- Title bar ----
		let titleBar = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		Object.assign(titleBar.style, {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			padding: '10px 14px',
			background: 'rgba(255,255,255,0.04)',
			borderBottom: '1px solid rgba(255,255,255,0.08)',
			cursor: 'move',
			flexShrink: '0',
			userSelect: 'none',
		});

		let titleLeft = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		Object.assign(titleLeft.style, { display: 'flex', alignItems: 'center', gap: '8px' });
		let iconSvg = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
		iconSvg.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c8cf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
		titleLeft.appendChild(iconSvg);
		let titleText = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
		titleText.textContent = 'AI Explanation';
		Object.assign(titleText.style, { fontWeight: '600', fontSize: '13px', color: '#e8eaf6' });
		titleLeft.appendChild(titleText);
		titleBar.appendChild(titleLeft);

		let statusBadge = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
		statusBadge.id = 'zotero-explanation-status-badge';
		statusBadge.textContent = 'Analyzing\u2026';
		Object.assign(statusBadge.style, { fontSize: '11px', color: '#7c8cf8', fontWeight: '500', marginRight: '8px' });
		titleBar.appendChild(statusBadge);

		let closeBtn = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button');
		closeBtn.textContent = '\u00d7';
		closeBtn.setAttribute('aria-label', 'Close');
		Object.assign(closeBtn.style, {
			background: 'rgba(255,255,255,0.08)', border: 'none', color: '#aaa', fontSize: '18px', lineHeight: '1',
			width: '26px', height: '26px', borderRadius: '6px', cursor: 'pointer',
			display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0', flexShrink: '0',
		});
		closeBtn.addEventListener('click', () => panel.remove());
		closeBtn.addEventListener('mouseover', () => { closeBtn.style.background = 'rgba(255,255,255,0.15)'; });
		closeBtn.addEventListener('mouseout', () => { closeBtn.style.background = 'rgba(255,255,255,0.08)'; });
		titleBar.appendChild(closeBtn);
		panel.appendChild(titleBar);

		// ---- Content area (fixed height, scrollable) ----
		let content = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		content.id = 'zotero-explanation-content';
		Object.assign(content.style, {
			padding: '16px 18px',
			overflowY: 'auto',
			flex: '1 1 0',
			minHeight: '0',
			height: '280px',
			whiteSpace: 'pre-wrap',
			wordBreak: 'break-word',
		});
		panel.appendChild(content);

		// Blinking cursor (streaming)
		let cursor = doc.createElementNS('http://www.w3.org/1999/xhtml', 'span');
		cursor.id = 'zotero-explanation-cursor';
		cursor.textContent = '\u258c';
		Object.assign(cursor.style, {
			display: 'inline-block',
			animation: 'zotero-cursor-blink 0.9s step-end infinite',
			color: '#7c8cf8',
			marginLeft: '1px',
		});
		if (!document.getElementById('zotero-explanation-keyframes')) {
			let style = doc.createElementNS('http://www.w3.org/1999/xhtml', 'style');
			style.id = 'zotero-explanation-keyframes';
			style.textContent = `@keyframes zotero-cursor-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }`;
			(document.head || document.documentElement).appendChild(style);
		}
		content.appendChild(cursor);

		// ---- Chat input row ----
		let inputRow = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		Object.assign(inputRow.style, {
			display: 'flex',
			gap: '8px',
			padding: '10px 14px',
			borderTop: '1px solid rgba(255,255,255,0.08)',
			background: 'rgba(0,0,0,0.2)',
			flexShrink: '0',
		});
		let input = doc.createElementNS('http://www.w3.org/1999/xhtml', 'input');
		input.type = 'text';
		input.placeholder = 'Follow up…';
		input.id = 'zotero-explanation-input';
		Object.assign(input.style, {
			flex: '1',
			padding: '8px 12px',
			borderRadius: '8px',
			border: '1px solid rgba(255,255,255,0.15)',
			background: 'rgba(255,255,255,0.06)',
			color: '#e8eaf6',
			fontSize: '13px',
		});
		let sendBtn = doc.createElementNS('http://www.w3.org/1999/xhtml', 'button');
		sendBtn.textContent = 'Send';
		Object.assign(sendBtn.style, {
			padding: '8px 16px',
			borderRadius: '8px',
			border: 'none',
			background: '#7c8cf8',
			color: '#fff',
			fontWeight: '600',
			cursor: 'pointer',
			flexShrink: '0',
		});
		inputRow.appendChild(input);
		inputRow.appendChild(sendBtn);
		panel.appendChild(inputRow);

		this._makeElementDraggable(panel, titleBar);
		document.documentElement.appendChild(panel);

		// Conversation state (set when first response completes)
		panel._messages = [];
		panel._firstImageBase64 = null;
		panel._contentEl = content;
		panel._cursorEl = cursor;
		panel._inputEl = input;
		panel._sendBtn = sendBtn;

		let self = this;
		sendBtn.addEventListener('click', () => {
			let text = (input.value || '').trim();
			if (!text) return;
			input.value = '';
			self._sendFollowUp(panel, text);
		});
		input.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				sendBtn.click();
			}
		});

		panel.renderStream = (rawText) => {
			this._renderStreamingMarkdownAndMath(content, cursor, rawText);
		};

		panel.setDone = (fullText) => {
			cursor.remove();
			let badge = document.getElementById('zotero-explanation-status-badge');
			if (badge) {
				badge.textContent = 'Done';
				badge.style.color = '#5acea7';
			}
			if (fullText != null) {
				this._renderMarkdownAndMath(content, fullText);
			}
		};

		panel.setError = (msg) => {
			cursor.remove();
			content.textContent = msg;
			content.style.color = '#ff6b6b';
			let badge = document.getElementById('zotero-explanation-status-badge');
			if (badge) {
				badge.textContent = 'Error';
				badge.style.color = '#ff6b6b';
			}
		};

		return panel;
	},

	/**
	 * Simple Markdown to HTML (headers, bold, lists, paragraphs), then render LaTeX with KaTeX.
	 */
	_renderMarkdownAndMath(container, rawText) {
		if (!rawText || !container) return;
		let html = this._markdownToHtml(rawText);
		container.innerHTML = html;
		container.style.whiteSpace = 'normal';
		this._renderMathInElement(container);
		container.scrollTop = container.scrollHeight;
	},

	_renderStreamingMarkdownAndMath(container, cursor, rawText) {
		this._renderMarkdownAndMath(container, rawText || '');
		if (cursor) {
			container.appendChild(cursor);
		}
		container.scrollTop = container.scrollHeight;
	},

	_markdownToHtml(text) {
		let out = [];
		let lines = text.replace(/\r\n/g, '\n').split('\n');
		let i = 0;
		let inList = false;
		function flushList() {
			if (inList) { out.push('</ul>'); inList = false; }
		}
		function escape(s) {
			return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		}
		while (i < lines.length) {
			let line = lines[i];
			let trimmed = line.trim();
			// Display math block \[ ... \] (may span multiple lines)
			if (trimmed === '\\[') {
				flushList();
				let mathLines = [];
				i++;
				while (i < lines.length && lines[i].trim() !== '\\]') {
					mathLines.push(lines[i]);
					i++;
				}
				if (i < lines.length) i++; // skip "\]"
				let mathContent = mathLines.join('\n').trim();
				out.push('<div class="zotero-explain-displaymath">' + escape(mathContent) + '</div>');
				continue;
			}
			if (/^###\s/.test(trimmed)) {
				flushList();
				out.push('<h3 class="zotero-explain-h3">' + escape(trimmed.slice(3).trim()) + '</h3>');
			}
			else if (/^##\s/.test(trimmed)) {
				flushList();
				out.push('<h2 class="zotero-explain-h2">' + escape(trimmed.slice(2).trim()) + '</h2>');
			}
			else if (/^#\s/.test(trimmed)) {
				flushList();
				out.push('<h1 class="zotero-explain-h1">' + escape(trimmed.slice(1).trim()) + '</h1>');
			}
			else if (/^-\s+/.test(trimmed) || /^\*\s+/.test(trimmed)) {
				if (!inList) { out.push('<ul class="zotero-explain-ul">'); inList = true; }
				let item = trimmed.replace(/^[-*]\s+/, '');
				item = escape(item).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
				out.push('<li>' + item + '</li>');
			}
			else if (trimmed === '') {
				flushList();
				out.push('<p class="zotero-explain-p">\u200b</p>');
			}
			else {
				flushList();
				let span = escape(trimmed).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
				out.push('<p class="zotero-explain-p">' + span + '</p>');
			}
			i++;
		}
		flushList();
		return out.join('');
	},

	_renderMathInElement(container) {
		let doc = container.ownerDocument;
		if (!doc.defaultView) return;
		let win = doc.defaultView;
		if (!win.katex) {
			let link = doc.createElementNS('http://www.w3.org/1999/xhtml', 'link');
			link.rel = 'stylesheet';
			link.href = 'chrome://zotero/content/katex/katex.min.css';
			(doc.head || doc.documentElement).appendChild(link);
			let script = doc.createElementNS('http://www.w3.org/1999/xhtml', 'script');
			script.src = 'chrome://zotero/content/katex/katex.min.js';
			script.onload = () => this._runKaTeX(container);
			(doc.head || doc.documentElement).appendChild(script);
			return;
		}
		this._runKaTeX(container);
	},

	_runKaTeX(container) {
		let win = container.ownerDocument.defaultView;
		if (!win.katex) return;
		function escapeHtml(s) {
			return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
		}
		// Render display-math divs (from multi-line \[ ... \] blocks)
		let displayDivs = container.querySelectorAll('.zotero-explain-displaymath');
		for (let div of displayDivs) {
			let math = div.textContent.trim();
			try {
				div.innerHTML = win.katex.renderToString(math, { displayMode: true, throwOnError: false });
			}
			catch (e) {
				div.innerHTML = '<span class="zotero-explain-math-err">' + escapeHtml(math) + '</span>';
			}
		}
		// Replace any remaining \[ ... \] and \( ... \) in the HTML (single-line display, inline)
		let text = container.innerHTML;
		text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, math) => {
			try {
				return win.katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
			}
			catch (e) {
				return '<span class="zotero-explain-math-err">' + escapeHtml('\\[' + math + '\\]') + '</span>';
			}
		});
		text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, math) => {
			try {
				return win.katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
			}
			catch (e) {
				return '<span class="zotero-explain-math-err">' + escapeHtml('\\(' + math + '\\)') + '</span>';
			}
		});
		container.innerHTML = text;
	},

	_makeElementDraggable(el, handle) {
		let startX, startY, startLeft, startBottom;

		handle.addEventListener('mousedown', (e) => {
			if (e.target.tagName === 'BUTTON') return;

			let rect = el.getBoundingClientRect();
			startX = e.clientX;
			startY = e.clientY;
			startLeft = rect.left;
			startBottom = window.innerHeight - rect.bottom;

			let onMove = (e) => {
				let dx = e.clientX - startX;
				let dy = e.clientY - startY;
				el.style.left = (startLeft + dx) + 'px';
				el.style.right = 'auto';
				el.style.bottom = (startBottom - dy) + 'px';
				el.style.top = 'auto';
			};

			let onUp = () => {
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onUp);
			};

			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
			e.preventDefault();
		});
	},

	// -------------------------------------------------------------------------
	// Anthropic Claude Vision API call (streaming)
	// -------------------------------------------------------------------------

	async _callClaude(imageDataURL, panel) {
		let apiKey = '';
		try {
			apiKey = Zotero.Prefs.get('anthropic.apiKey');
		}
		catch (e) {}

		let model = 'claude-sonnet-4-6';
		try {
			model = Zotero.Prefs.get('anthropic.model') || model;
		}
		catch (e) {}

		let prompt = this._EXPLANATION_PROMPT;
		let base64Data = imageDataURL.replace(/^data:image\/\w+;base64,/, '');

		let userMsg = {
			role: 'user',
			content: [
				{ type: 'text', text: prompt },
				{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Data } },
			],
		};

		let body = JSON.stringify({
			model,
			max_tokens: 4096,
			messages: [userMsg],
			stream: true,
		});

		let response;
		try {
			response = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
				},
				body,
			});
		}
		catch (err) {
			panel.setError('Network error: ' + err.message);
			return;
		}

		if (!response.ok) {
			let errText = await response.text().catch(() => '');
			let errMsg;
			try {
				let parsed = JSON.parse(errText);
				errMsg = parsed?.error?.message || errText;
			}
			catch (e) {
				errMsg = errText || ('HTTP ' + response.status);
			}
			panel.setError('API error: ' + errMsg);
			return;
		}

		let fullText = '';
		let reader = response.body.getReader();
		let decoder = new TextDecoder('utf-8');
		let buffer = '';
		let renderDelay = 120;
		let lastRenderAt = 0;
		let renderTimer = null;
		let scheduleRender = () => {
			let now = Date.now();
			let elapsed = now - lastRenderAt;
			if (elapsed >= renderDelay) {
				lastRenderAt = now;
				panel.renderStream(fullText);
				return;
			}
			if (renderTimer) return;
			renderTimer = setTimeout(() => {
				renderTimer = null;
				lastRenderAt = Date.now();
				panel.renderStream(fullText);
			}, renderDelay - elapsed);
		};
		let flushRender = () => {
			if (renderTimer) {
				clearTimeout(renderTimer);
				renderTimer = null;
			}
			panel.renderStream(fullText);
		};

		try {
			while (true) {
				let { done, value } = await reader.read();
				if (done) {
					flushRender();
					panel._messages = [userMsg, { role: 'assistant', content: fullText }];
					panel._firstImageBase64 = base64Data;
					panel.setDone(fullText);
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				let lines = buffer.split('\n');
				buffer = lines.pop();

				for (let line of lines) {
					line = line.trim();
					if (!line.startsWith('data: ')) continue;
					let data = line.slice(6);
					if (data === '[DONE]') {
						flushRender();
						panel._messages = [userMsg, { role: 'assistant', content: fullText }];
						panel._firstImageBase64 = base64Data;
						panel.setDone(fullText);
						return;
					}
					try {
						let parsed = JSON.parse(data);
						if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
							fullText += parsed.delta.text;
							scheduleRender();
						}
					}
					catch (e) {}
				}
			}
		}
		catch (err) {
			if (renderTimer) {
				clearTimeout(renderTimer);
			}
			Zotero.logError('Screenshot Explainer: stream read error -- ' + err);
			panel.setError('Stream error: ' + err.message);
		}
	},

	async _sendFollowUp(panel, userText) {
		panel._messages.push({ role: 'user', content: userText });
		panel._sendBtn.disabled = true;
		panel._inputEl.disabled = true;
		let statusBadge = document.getElementById('zotero-explanation-status-badge');
		if (statusBadge) {
			statusBadge.textContent = 'Thinking…';
			statusBadge.style.color = '#7c8cf8';
		}

		let content = panel._contentEl;
		// Add user message as a line in the content, then streaming cursor
		let userBubble = content.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		userBubble.className = 'zotero-explain-user-msg';
		userBubble.style.cssText = 'margin: 8px 0; padding: 6px 10px; background: rgba(124,140,248,0.15); border-radius: 8px; font-size: 13px;';
		userBubble.textContent = userText;
		content.appendChild(userBubble);

		let cursor = panel._cursorEl;
		if (!cursor.parentNode) {
			cursor = content.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'span');
			cursor.id = 'zotero-explanation-cursor';
			cursor.textContent = '\u258c';
			cursor.style.cssText = 'display:inline-block; animation: zotero-cursor-blink 0.9s step-end infinite; color:#7c8cf8; margin-left:1px;';
			panel._cursorEl = cursor;
		}
		let assistantWrap = content.ownerDocument.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		assistantWrap.className = 'zotero-explain-assistant-block';
		content.appendChild(assistantWrap);
		assistantWrap.appendChild(cursor);
		content.scrollTop = content.scrollHeight;

		let apiKey = '';
		try { apiKey = Zotero.Prefs.get('anthropic.apiKey'); } catch (e) {}
		let model = 'claude-sonnet-4-6';
		try { model = Zotero.Prefs.get('anthropic.model') || model; } catch (e) {}

		// API expects messages without image in follow-up (we already have it in first user message)
		let messagesForApi = panel._messages.map(m => ({
			role: m.role,
			content: typeof m.content === 'string' ? m.content : m.content,
		}));

		let body = JSON.stringify({
			model,
			max_tokens: 4096,
			messages: messagesForApi,
			stream: true,
		});

		let response;
		try {
			response = await fetch('https://api.anthropic.com/v1/messages', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-api-key': apiKey,
					'anthropic-version': '2023-06-01',
				},
				body,
			});
		}
		catch (err) {
			panel._sendBtn.disabled = false;
			panel._inputEl.disabled = false;
			if (statusBadge) { statusBadge.textContent = 'Error'; statusBadge.style.color = '#ff6b6b'; }
			panel.setError('Network error: ' + err.message);
			return;
		}

		if (!response.ok) {
			let errText = await response.text().catch(() => '');
			let errMsg;
			try {
				let parsed = JSON.parse(errText);
				errMsg = parsed?.error?.message || errText;
			}
			catch (e) { errMsg = errText || ('HTTP ' + response.status); }
			panel._sendBtn.disabled = false;
			panel._inputEl.disabled = false;
			if (statusBadge) { statusBadge.textContent = 'Error'; statusBadge.style.color = '#ff6b6b'; }
			panel.setError('API error: ' + errMsg);
			panel._messages.pop();
			return;
		}

		let fullText = '';
		let reader = response.body.getReader();
		let decoder = new TextDecoder('utf-8');
		let buffer = '';
		let renderDelay = 120;
		let lastRenderAt = 0;
		let renderTimer = null;
		let scheduleRender = () => {
			let now = Date.now();
			let elapsed = now - lastRenderAt;
			if (elapsed >= renderDelay) {
				lastRenderAt = now;
				this._renderStreamingMarkdownAndMath(assistantWrap, cursor, fullText);
				return;
			}
			if (renderTimer) return;
			renderTimer = setTimeout(() => {
				renderTimer = null;
				lastRenderAt = Date.now();
				this._renderStreamingMarkdownAndMath(assistantWrap, cursor, fullText);
			}, renderDelay - elapsed);
		};
		let finalizeStream = () => {
			if (renderTimer) {
				clearTimeout(renderTimer);
				renderTimer = null;
			}
			cursor.remove();
			this._renderMarkdownAndMath(assistantWrap, fullText);
			panel._messages.push({ role: 'assistant', content: fullText });
			if (statusBadge) {
				statusBadge.textContent = 'Done';
				statusBadge.style.color = '#5acea7';
			}
			panel._sendBtn.disabled = false;
			panel._inputEl.disabled = false;
			content.scrollTop = content.scrollHeight;
		};

		try {
			while (true) {
				let { done, value } = await reader.read();
				if (done) {
					finalizeStream();
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				let lines = buffer.split('\n');
				buffer = lines.pop();
				for (let line of lines) {
					line = line.trim();
					if (!line.startsWith('data: ')) continue;
					let data = line.slice(6);
					if (data === '[DONE]') {
						finalizeStream();
						return;
					}
					try {
						let parsed = JSON.parse(data);
						if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
							fullText += parsed.delta.text;
							scheduleRender();
						}
					}
					catch (e) {}
				}
			}
		}
		catch (err) {
			if (renderTimer) {
				clearTimeout(renderTimer);
			}
			Zotero.logError('Screenshot Explainer: follow-up stream error -- ' + err);
			cursor.remove();
			panel.setError('Stream error: ' + err.message);
			panel._messages.pop();
			panel._sendBtn.disabled = false;
			panel._inputEl.disabled = false;
		}
	},

	// -------------------------------------------------------------------------
	// Toast notification (brief error/info message)
	// -------------------------------------------------------------------------

	_showToast(msg, isError = false) {
		let doc = document;
		let toast = doc.createElementNS('http://www.w3.org/1999/xhtml', 'div');
		Object.assign(toast.style, {
			position: 'fixed',
			top: '20px',
			right: '20px',
			background: isError ? '#c0392b' : '#2c3e50',
			color: '#fff',
			padding: '10px 18px',
			borderRadius: '8px',
			zIndex: '99999',
			fontFamily: 'sans-serif',
			fontSize: '13px',
			boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
		});
		toast.textContent = msg;
		document.documentElement.appendChild(toast);
		setTimeout(() => toast.remove(), 5000);
	},
};

// Ensure the toolbar button's oncommand can find us (XUL may use a different scope)
if (typeof window !== 'undefined') {
	window.Zotero_Screenshot_Explainer = Zotero_Screenshot_Explainer;
}

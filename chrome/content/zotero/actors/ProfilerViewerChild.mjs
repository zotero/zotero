export class ProfilerViewerChild extends JSWindowActorChild {
	async handleEvent(event) {
		if (event.type !== "click" || event.defaultPrevented) {
			return;
		}
		let target = event.composedTarget || event.originalTarget || event.target;
		let a = target?.closest?.("a[href]");
		if (!a) return;
		let href = a.href;

		if (href.startsWith("blob:") && a.hasAttribute("download")) {
			event.preventDefault();
			event.stopPropagation();
			let contentBuffer = await (await fetch(href)).arrayBuffer();
			let bytes = new Uint8Array(contentBuffer.byteLength);
			bytes.set(new Uint8Array(contentBuffer));
			this.sendAsyncMessage("ProfilerViewer:Download", {
				filename: a.download || "profile",
				bytes,
			});
			return;
		}

		if (/^https?:/.test(href)) {
			let isOffOrigin = !href.startsWith("https://profiler.firefox.com/");
			if (a.target === "_blank" || isOffOrigin) {
				event.preventDefault();
				event.stopPropagation();
				this.sendAsyncMessage("ProfilerViewer:OpenExternal", { href });
			}
		}
	}
}

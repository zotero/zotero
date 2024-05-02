var EXPORTED_SYMBOLS = ["ZoteroPrintChild"];


class ZoteroPrintChild extends JSWindowActorChild {
	actorCreated() {
		Cu.exportFunction(
			() => new this.contentWindow.Promise(
				(resolve, reject) => this._sendZoteroPrint().then(resolve, reject)
			),
			this.contentWindow,
			{ defineAs: "zoteroPrint" }
		);
	}

	async handleEvent(event) {
		switch (event.type) {
			case "pageshow": {
				// We just need this to trigger actor creation
			}
		}
	}

	async _sendZoteroPrint() {
		await this.sendQuery("zoteroPrint");
	}
}

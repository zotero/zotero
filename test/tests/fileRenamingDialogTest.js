describe("FileRenamingDialog", function () {
	let win;
	let group;

	before(async function () {
		group = await getGroup();
		win = await loadWindow("chrome://zotero/content/fileRenamingDialog.xhtml");
	});

	after(function () {
		if (win) {
			win.close();
		}
	});

	describe("#handleSettingsChange()", function () {
		// Drives handleSettingsChange for a given library/template with SyncedSettings.set stubbed,
		// returning the values the template setting would have been synced with
		function collectTemplateSyncs(libraryID, template) {
			let dialog = win.FileRenamingDialog;
			dialog.libraryPicker.value = String(libraryID);
			dialog._currentLibraryID = libraryID;
			dialog.loadSettingsForLibrary(libraryID);
			dialog.settingsEl.formatTemplate = template;

			let sandbox = sinon.createSandbox();
			let setStub = sandbox.stub(Zotero.SyncedSettings, "set").resolves();
			let clearStub = sandbox.stub(Zotero.SyncedSettings, "clear").resolves();
			sandbox.stub(Zotero.Prefs, "set");
			try {
				dialog.handleSettingsChange({
					detail: {
						autoRenameEnabled: true,
						enabledFileTypes: 'application/pdf',
						renameLinkedEnabled: false,
						formatTemplate: template
					}
				});
				return {
					otherSynced: setStub.getCalls().some(c => c.args[1] !== 'attachmentRenameTemplate'),
					templateValues: setStub.getCalls()
						.filter(c => c.args[1] === 'attachmentRenameTemplate')
						.map(c => c.args[2]),
					templateCleared: clearStub.getCalls()
						.some(c => c.args[1] === 'attachmentRenameTemplate')
				};
			}
			finally {
				sandbox.restore();
			}
		}

		it("should not push an invalid template to a group's synced settings", function () {
			let invalid = collectTemplateSyncs(group.libraryID, '{{ title');
			assert.deepEqual(invalid.templateValues, [], "invalid template must not be synced");
			assert.isTrue(invalid.otherSynced, "other group settings should still be synced");

			let valid = collectTemplateSyncs(group.libraryID, '{{ title }}');
			assert.deepEqual(valid.templateValues, ['{{ title }}'], "valid template must be synced");
		});

		it("should clear a group's template setting when the template is emptied", function () {
			for (let empty of ['', '   ']) {
				let result = collectTemplateSyncs(group.libraryID, empty);
				assert.deepEqual(result.templateValues, [], `empty template ${JSON.stringify(empty)} must not be synced`);
				assert.isTrue(result.templateCleared, "empty template must be cleared from a group's synced settings");
				assert.isTrue(result.otherSynced, "other group settings should still be synced");
			}
		});

		it("should not push an invalid template to the user library's synced settings", function () {
			let invalid = collectTemplateSyncs(Zotero.Libraries.userLibraryID, '{{ title');
			assert.deepEqual(invalid.templateValues, [], "invalid template must not be synced");

			let valid = collectTemplateSyncs(Zotero.Libraries.userLibraryID, '{{ title }}');
			assert.deepEqual(valid.templateValues, ['{{ title }}'], "valid template must be synced");
		});
	});

	describe("invalid template prompt", function () {
		const INVALID_TEMPLATE = '{{ title';

		// Loads the given library and applies a template change through the dialog's change
		// handler (with persistence stubbed by the caller), leaving the dialog dirty
		function makeDirty(libraryID, template) {
			let dialog = win.FileRenamingDialog;
			dialog.libraryPicker.value = String(libraryID);
			dialog._currentLibraryID = libraryID;
			dialog.loadSettingsForLibrary(libraryID);
			dialog.settingsEl.formatTemplate = template;
			dialog.handleSettingsChange({
				detail: {
					autoRenameEnabled: dialog.settingsEl.autoRenameEnabled,
					enabledFileTypes: dialog.settingsEl.enabledFileTypes,
					renameLinkedEnabled: dialog.settingsEl.renameLinkedEnabled,
					formatTemplate: template
				}
			});
			return dialog;
		}

		function setupStubs(sandbox, confirmIndex) {
			return {
				set: sandbox.stub(Zotero.SyncedSettings, 'set').resolves(),
				clear: sandbox.stub(Zotero.SyncedSettings, 'clear').resolves(),
				prefSet: sandbox.stub(Zotero.Prefs, 'set'),
				confirm: sandbox.stub(Zotero.Prompt, 'confirm').returns(confirmIndex)
			};
		}

		function resetStubHistory(stubs) {
			stubs.set.resetHistory();
			stubs.clear.resetHistory();
			stubs.prefSet.resetHistory();
		}

		function templateWrites(stubs) {
			return {
				sets: stubs.set.getCalls().filter(c => c.args[1] === 'attachmentRenameTemplate'),
				clears: stubs.clear.getCalls().filter(c => c.args[1] === 'attachmentRenameTemplate')
			};
		}

		function restoreDialog() {
			let dialog = win.FileRenamingDialog;
			dialog._forceClose = false;
			dialog.libraryPicker.value = String(Zotero.Libraries.userLibraryID);
			dialog._currentLibraryID = Zotero.Libraries.userLibraryID;
			dialog.loadSettingsForLibrary(Zotero.Libraries.userLibraryID);
		}

		it("should keep the window open and not touch the template setting on cancel", async function () {
			let sandbox = sinon.createSandbox();
			let stubs = setupStubs(sandbox, 1);
			let origClose = win.close;
			let closeSpy = sinon.spy();
			win.close = closeSpy;
			try {
				let dialog = makeDirty(group.libraryID, INVALID_TEMPLATE);
				resetStubHistory(stubs);
				let event = { preventDefault: sinon.spy() };
				await dialog.handleWindowClose(event);
				assert.isTrue(event.preventDefault.called, 'close must be blocked');
				assert.isFalse(closeSpy.called, 'window must stay open on cancel');
				assert.equal(stubs.confirm.callCount, 1, 'prompt shown once');
				assert.isString(stubs.confirm.firstCall.args[0].title, 'prompt title must resolve to a string');
				assert.isString(stubs.confirm.firstCall.args[0].text, 'prompt body must resolve to a string');
				let { sets, clears } = templateWrites(stubs);
				assert.lengthOf(sets, 0, 'template must not be synced on cancel');
				assert.lengthOf(clears, 0, 'template must not be cleared on cancel');
			}
			finally {
				win.close = origClose;
				sandbox.restore();
				restoreDialog();
			}
		});

		it("should clear the group's template setting and close on reset", async function () {
			let sandbox = sinon.createSandbox();
			let stubs = setupStubs(sandbox, 0);
			let origClose = win.close;
			let closeSpy = sinon.spy();
			win.close = closeSpy;
			try {
				let dialog = makeDirty(group.libraryID, INVALID_TEMPLATE);
				resetStubHistory(stubs);
				let event = { preventDefault: sinon.spy() };
				await dialog.handleWindowClose(event);
				assert.isString(stubs.confirm.firstCall.args[0].title, 'prompt title must resolve to a string');
				assert.isString(stubs.confirm.firstCall.args[0].text, 'prompt body must resolve to a string');
				let { sets, clears } = templateWrites(stubs);
				assert.lengthOf(sets, 0, 'template must not be synced on reset');
				assert.lengthOf(clears, 1, 'template setting must be cleared');
				assert.equal(clears[0].args[0], group.libraryID);
				assert.isFalse(
					stubs.prefSet.calledWith('autoRenameFiles.done', sinon.match.any),
					'user-library done pref must not change for a group reset'
				);
				assert.isTrue(closeSpy.called, 'window must close after reset');
			}
			finally {
				win.close = origClose;
				sandbox.restore();
				restoreDialog();
			}
		});

		it("should clear the user library's template setting and recompute the done pref on reset", async function () {
			let userLibraryID = Zotero.Libraries.userLibraryID;
			// Make the baseline deterministic: default template stored, no rename pending
			let origTemplate = Zotero.SyncedSettings.get(userLibraryID, 'attachmentRenameTemplate');
			let origDone = Zotero.Prefs.get('autoRenameFiles.done');
			await Zotero.SyncedSettings.clear(userLibraryID, 'attachmentRenameTemplate');
			Zotero.Prefs.set('autoRenameFiles.done', true);

			let sandbox = sinon.createSandbox();
			let stubs = setupStubs(sandbox, 0);
			let origClose = win.close;
			let closeSpy = sinon.spy();
			win.close = closeSpy;
			try {
				let dialog = makeDirty(userLibraryID, INVALID_TEMPLATE);
				resetStubHistory(stubs);
				let event = { preventDefault: sinon.spy() };
				await dialog.handleWindowClose(event);
				assert.isString(stubs.confirm.firstCall.args[0].title, 'prompt title must resolve to a string');
				assert.isString(stubs.confirm.firstCall.args[0].text, 'prompt body must resolve to a string');
				let { sets, clears } = templateWrites(stubs);
				assert.lengthOf(sets, 0, 'template must not be synced on reset');
				assert.lengthOf(clears, 1, 'template setting must be cleared');
				assert.equal(clears[0].args[0], userLibraryID);
				// The reset lands back on the baseline, so no rename is pending
				assert.isTrue(
					stubs.prefSet.calledWith('autoRenameFiles.done', true),
					'done pref must be recomputed against the baseline, not hard-set to false'
				);
				assert.isTrue(closeSpy.called, 'window must close after reset');
			}
			finally {
				win.close = origClose;
				sandbox.restore();
				if (origTemplate) {
					await Zotero.SyncedSettings.set(userLibraryID, 'attachmentRenameTemplate', origTemplate);
				}
				Zotero.Prefs.set('autoRenameFiles.done', origDone);
				restoreDialog();
			}
		});

		it("should keep the window open when Done is clicked and the user cancels", async function () {
			let sandbox = sinon.createSandbox();
			let stubs = setupStubs(sandbox, 1);
			let origClose = win.close;
			let closeSpy = sinon.spy();
			win.close = closeSpy;
			try {
				let dialog = makeDirty(group.libraryID, INVALID_TEMPLATE);
				resetStubHistory(stubs);
				await dialog._handleDoneClick();
				assert.isFalse(closeSpy.called, 'window must stay open on cancel');
				assert.equal(stubs.confirm.callCount, 1, 'only the invalid-template prompt is shown');
				let { sets, clears } = templateWrites(stubs);
				assert.lengthOf(sets, 0);
				assert.lengthOf(clears, 0);
			}
			finally {
				win.close = origClose;
				sandbox.restore();
				restoreDialog();
			}
		});

		it("should stay on the current library when switching libraries and the user cancels", async function () {
			let sandbox = sinon.createSandbox();
			let stubs = setupStubs(sandbox, 1);
			try {
				let dialog = makeDirty(group.libraryID, INVALID_TEMPLATE);
				resetStubHistory(stubs);
				dialog.libraryPicker.value = String(Zotero.Libraries.userLibraryID);
				await dialog.handleLibraryChange();
				assert.equal(dialog.libraryPicker.value, String(group.libraryID), 'picker must revert to the previous library');
				assert.equal(dialog._currentLibraryID, group.libraryID, 'current library must not change');
				let { sets, clears } = templateWrites(stubs);
				assert.lengthOf(sets, 0);
				assert.lengthOf(clears, 0);
			}
			finally {
				sandbox.restore();
				restoreDialog();
			}
		});

		it("should reset the previous library's template and switch libraries on reset", async function () {
			let sandbox = sinon.createSandbox();
			let stubs = setupStubs(sandbox, 0);
			try {
				let dialog = makeDirty(group.libraryID, INVALID_TEMPLATE);
				resetStubHistory(stubs);
				dialog.libraryPicker.value = String(Zotero.Libraries.userLibraryID);
				await dialog.handleLibraryChange();
				let { clears } = templateWrites(stubs);
				assert.lengthOf(clears, 1, 'previous library template setting must be cleared');
				assert.equal(clears[0].args[0], group.libraryID);
				assert.equal(dialog._currentLibraryID, Zotero.Libraries.userLibraryID, 'switch must proceed after reset');
				assert.equal(dialog.libraryPicker.value, String(Zotero.Libraries.userLibraryID));
			}
			finally {
				sandbox.restore();
				restoreDialog();
			}
		});

		it("should only prompt when settings changed and the template is invalid", function () {
			let sandbox = sinon.createSandbox();
			setupStubs(sandbox, 1);
			try {
				let dialog = makeDirty(group.libraryID, INVALID_TEMPLATE);
				assert.isTrue(dialog._shouldPromptInvalidTemplate(), 'changed + invalid must prompt');

				makeDirty(group.libraryID, '{{ title }}{{ year }}');
				assert.isFalse(dialog._shouldPromptInvalidTemplate(), 'changed + valid must not prompt');

				dialog.loadSettingsForLibrary(group.libraryID);
				dialog.settingsEl.formatTemplate = INVALID_TEMPLATE;
				assert.isFalse(dialog._shouldPromptInvalidTemplate(), 'unchanged + invalid must not prompt');
			}
			finally {
				sandbox.restore();
				restoreDialog();
			}
		});
	});

	describe("template preview", function () {
		it("should clear a stale syntax-error message when the template is cleared to whitespace", function () {
			let settingsEl = win.FileRenamingDialog.settingsEl;
			// Show the invalid state (updatePreview has no change side effects)
			settingsEl.formatTemplate = '{{ title';
			settingsEl.updatePreview();
			assert.isFalse(settingsEl.invalidMessage.classList.contains('is-hidden'), 'error shown while invalid');
			assert.isTrue(settingsEl.previewSection.classList.contains('is-hidden'), 'preview hidden while invalid');
			// Deleting down to whitespace must clear the stale error and restore the preview
			settingsEl.formatTemplate = '   ';
			settingsEl.handleTemplateInput();
			assert.isTrue(settingsEl.invalidMessage.classList.contains('is-hidden'), 'error cleared for whitespace');
			assert.isFalse(settingsEl.previewSection.classList.contains('is-hidden'), 'preview restored for whitespace');
		});

		it("should validate the template as the engine renders it, ignoring newlines inside a tag", function () {
			let settingsEl = win.FileRenamingDialog.settingsEl;
			// The engine strips newlines before validating/rendering, so the dialog must judge the
			// same normalized string -- a newline splitting `endif` here must not read as invalid
			settingsEl.formatTemplate = '{{if title}}a{{end\nif}}';
			assert.isTrue(settingsEl.templateValid, 'newline inside a tag must not read as invalid');
		});

		it("should validate the template at most once per keystroke", function () {
			let settingsEl = win.FileRenamingDialog.settingsEl;
			settingsEl.formatTemplate = '{{ title }}{{ year }}';
			let sandbox = sinon.createSandbox();
			// Stub persistence so the change handler runs without touching settings
			sandbox.stub(Zotero.SyncedSettings, 'set').resolves();
			sandbox.stub(Zotero.SyncedSettings, 'clear').resolves();
			sandbox.stub(Zotero.Prefs, 'set');
			let spy = sandbox.spy(settingsEl, '_validateTemplate');
			try {
				settingsEl.handleTemplateInput();
				assert.isAtMost(spy.callCount, 1, 'template should be parsed at most once per keystroke');
			}
			finally {
				sandbox.restore();
			}
		});
	});
});

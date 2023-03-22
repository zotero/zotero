/* global Zotero_Import_Folder: false */

describe('Zotero_Import_Folder', function () {
	var tmpDir;
	const uc = name => 'Zotero_Import_Folder_' + name;

	before(async () => {
		tmpDir = await getTempDirectory();

		await OS.File.makeDir(OS.Path.join(tmpDir, uc('dir1')));
		await OS.File.makeDir(OS.Path.join(tmpDir, uc('dir1'), uc('subdir1')));
		await OS.File.makeDir(OS.Path.join(tmpDir, uc('dir2')));
		
		await OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'recognizePDF_test_title.pdf'),
			OS.Path.join(tmpDir, 'recognizePDF_test_title.pdf')
		);
		await OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'recognizePDF_test_title.pdf'),
			OS.Path.join(tmpDir, uc('dir1'), 'recognizePDF_test_title.pdf')
		);
		await OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'recognizePDF_test_arXiv.pdf'),
			OS.Path.join(tmpDir, uc('dir1'), uc('subdir1'), 'recognizePDF_test_arXiv.pdf')
		);
		await OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'recognizePDF_test_title.pdf'),
			OS.Path.join(tmpDir, uc('dir2'), 'recognizePDF_test_title.pdf')
		);
		await OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'test.png'),
			OS.Path.join(tmpDir, uc('dir2'), 'test.png')
		);
		await OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'test.html'),
			OS.Path.join(tmpDir, uc('dir2'), 'test.html')
		);
		await OS.File.copy(
			OS.Path.join(getTestDataDirectory().path, 'test.txt'),
			OS.Path.join(tmpDir, uc('dir2'), 'test.txt')
		);

		Components.utils.import('chrome://zotero/content/import/folderImport.js');
	});

	describe('#import', () => {
		it('should import PDFs from a folder and recreate structure without creating duplicates', async function () {
			// @TODO: re-enable when folder import is ready
			this.skip();
			this.timeout(30000);
			if (Zotero.automatedTest) {
				this.skip();
			}
			
			const importer = new Zotero_Import_Folder({
				folder: tmpDir,
				recreateStructure: true,
			});
			
			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				linkFiles: true,
			});

			assert.equal(importer.newItems.length, 2);

			const firstPDFAttachment = importer.newItems.find(ni => ni.getField('title') === 'recognizePDF_test_arXiv.pdf');
			const firstPDFItem = await Zotero.Items.getAsync(firstPDFAttachment.parentID);
			const firstPDFCollections = await Zotero.Collections.getAsync(firstPDFItem.getCollections());
			assert.equal(firstPDFItem.getField('title'), 'Scaling study of an improved fermion action on quenched lattices');
			assert.equal(firstPDFCollections.length, 1);
			assert.equal(firstPDFCollections[0].name, uc('subdir1'));
			assert.equal((await Zotero.Collections.getAsync(firstPDFCollections[0].parentID)).name, uc('dir1'));

			const secondPDFAttachment = importer.newItems.find(ni => ni.getField('title') === 'recognizePDF_test_title.pdf');
			const secondPDFItem = await Zotero.Items.getAsync(secondPDFAttachment.parentID);
			const secondPDFCollections = await Zotero.Collections.getAsync(secondPDFItem.getCollections());
			assert.equal(secondPDFItem.getField('title'), 'Bitcoin: A Peer-to-Peer Electronic Cash System');
			assert.equal(secondPDFCollections.length, 2);
			assert.sameMembers(secondPDFCollections.map(c => c.name), [uc('dir1'), uc('dir2')]);

			assert.sameMembers(
				Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID, true)
					.map(c => c.name)
					.filter(c => c.startsWith('Zotero_Import_Folder')),
				[uc('dir1'), uc('dir2'), uc('subdir1')]
			);

			const importer2 = new Zotero_Import_Folder({
				folder: tmpDir,
				recreateStructure: true,
			});
			
			await importer2.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				linkFiles: true,
			});

			assert.lengthOf(importer2.newItems, 0);
			assert.sameMembers(
				Zotero.Collections.getByLibrary(Zotero.Libraries.userLibraryID, true)
					.map(c => c.name)
					.filter(c => c.startsWith('Zotero_Import_Folder')),
				[uc('dir1'), uc('dir2'), uc('subdir1')]
			);
		});

		it('should only import specified file types from a folder', async function () {
			// @TODO: re-enable when folder import is ready
			this.skip();
			this.timeout(30000);
			if (Zotero.automatedTest) {
				this.skip();
			}
			const importer = new Zotero_Import_Folder({
				folder: tmpDir,
				recreateStructure: false,
				fileTypes: '*.png,*.TXT', // should match case-insensitively
				mimeTypes: []
			});
			
			await importer.translate({
				libraryID: Zotero.Libraries.userLibraryID,
				linkFiles: true,
			});

			assert.equal(importer.newItems.length, 2);
			const pngItem = importer.newItems.find(ni => ni.getField('title') === 'test.png');
			assert.isDefined(pngItem);
			assert.isFalse(pngItem.parentID);

			const txtItem = importer.newItems.find(ni => ni.getField('title') === 'test.txt');
			assert.isDefined(txtItem);
			assert.isFalse(txtItem.parentID);

			const htmlItem = importer.newItems.find(ni => ni.getField('title') === 'test.html');
			assert.isUndefined(htmlItem);
		});
	});
});

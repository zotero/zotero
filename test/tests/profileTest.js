"use strict";

describe("Zotero.Profile", function () {
	var tmpDir;
	var profile1 = "ht79g2qb.Test1";
	var profile2 = "b9auumgf.Test2";
	var profile3 = "7sgqhns3.Test3";
	
	beforeEach(function* () {
		tmpDir = yield getTempDirectory();
		var contents = `[General]
StartWithLastProfile=0

[Profile0]
Name=Test 1
IsRelative=1
Path=Profiles/${profile1}
Default=1

[Profile1]
Name=Test 2
IsRelative=1
Path=Profiles/${profile2}

[Profile1]
Name=Test 3
IsRelative=1
Path=Profiles/${profile3}
`;
		yield Zotero.File.putContentsAsync(OS.Path.join(tmpDir, "profiles.ini"), contents);
		yield OS.File.makeDir(
			OS.Path.join(tmpDir, "Profiles", profile1),
			{
				unixMode: 0o755,
				from: tmpDir
			}
		);
		yield OS.File.makeDir(OS.Path.join(tmpDir, "Profiles", profile2), { unixMode: 0o755 });
		yield OS.File.makeDir(OS.Path.join(tmpDir, "Profiles", profile3), { unixMode: 0o755 });
	});
	
	
	describe("#getDefaultInProfilesDir()", function () {
		it("should parse a profiles.ini file", async function () {
			var [dir, multiple] = await Zotero.Profile.getDefaultInProfilesDir(tmpDir);
			assert.equal(dir, OS.Path.join(tmpDir, "Profiles", profile1));
		});
	});
	
	
	describe("#findOtherProfilesUsingDataDirectory()", function () {
		it("should find profile with directory as a custom location", async function () {
			let dataDir = Zotero.DataDirectory.dir;
			let contents1 = `user_pref("extensions.lastAppVersion", "49.0");
user_pref("extensions.shownSelectionUI", true);
user_pref("extensions.ui.locale.hidden", true);
user_pref("loop.copy.ticket", 196);
`;
			let contents2 = `user_pref("extensions.lastAppVersion", "50.0");
user_pref("extensions.shownSelectionUI", true);
user_pref("extensions.zotero.dataDir", "${dataDir}");
user_pref("extensions.zotero.useDataDir", true);
user_pref("extensions.ui.locale.hidden", true);
user_pref("loop.copy.ticket", 196);
`;
			let otherDir = OS.Path.join(OS.Path.dirname(dataDir), "Other");
			let contents3 = `user_pref("extensions.lastAppVersion", "51.0");
user_pref("extensions.shownSelectionUI", true);
user_pref("extensions.zotero.dataDir", "${otherDir}");
user_pref("extensions.zotero.useDataDir", true);
user_pref("extensions.ui.locale.hidden", true);
user_pref("loop.copy.ticket", 196);
`;
			
			let prefsFile1 = OS.Path.join(tmpDir, "Profiles", profile1, "prefs.js");
			let prefsFile2 = OS.Path.join(tmpDir, "Profiles", profile2, "prefs.js");
			let prefsFile3 = OS.Path.join(tmpDir, "Profiles", profile3, "prefs.js");
			await Zotero.File.putContentsAsync(prefsFile1, contents1);
			await Zotero.File.putContentsAsync(prefsFile2, contents2);
			await Zotero.File.putContentsAsync(prefsFile3, contents3);
			
			var stub = sinon.stub(Zotero.Profile, "getOtherAppProfilesDir")
				.returns(OS.Path.join(tmpDir, "Profiles"));
			
			var dirs = await Zotero.Profile.findOtherProfilesUsingDataDirectory(dataDir);
			
			stub.restore();
			
			assert.sameMembers(dirs, [OS.Path.join(tmpDir, "Profiles", profile2)]);
			assert.lengthOf(dirs, 1);
		});
		
		
		it("should find other-app profile with directory as a legacy default location", async function () {
			let contents1 = `user_pref("extensions.lastAppVersion", "49.0");
user_pref("extensions.shownSelectionUI", true);
user_pref("extensions.ui.locale.hidden", true);
user_pref("loop.copy.ticket", 196);
`;
			let contents2 = `user_pref("extensions.lastAppVersion", "50.0");
user_pref("extensions.shownSelectionUI", true);
user_pref("extensions.ui.locale.hidden", true);
user_pref("loop.copy.ticket", 196);
`;
			
			let prefsFile1 = OS.Path.join(tmpDir, "Profiles", profile1, "prefs.js");
			let prefsFile2 = OS.Path.join(tmpDir, "Profiles", profile2, "prefs.js");
			await Zotero.File.putContentsAsync(prefsFile1, contents1);
			await Zotero.File.putContentsAsync(prefsFile2, contents2);
			
			var stub = sinon.stub(Zotero.Profile, "getOtherAppProfilesDir")
				.returns(OS.Path.join(tmpDir, "Profiles"));
			
			var dirs = await Zotero.Profile.findOtherProfilesUsingDataDirectory(
				OS.Path.join(OS.Path.dirname(prefsFile1), Zotero.DataDirectory.legacyDirName)
			);
			
			stub.restore();
			
			assert.sameMembers(dirs, [OS.Path.join(tmpDir, "Profiles", profile1)]);
			assert.lengthOf(dirs, 1);
		});
	});
	
	
	describe("#updateProfileDataDirectory()", function () {
		it("should add new lines to prefs.js", async function () {
			let prefsFile = OS.Path.join(tmpDir, "Profiles", profile1, "prefs.js");
			let oldDir = OS.Path.join(OS.Path.dirname(tmpDir), "Old", "Zotero");
			let newDir = OS.Path.join(OS.Path.dirname(tmpDir), "New", "Zotero");
			
			let contents = `user_pref("extensions.lastAppVersion", "50.0");
user_pref("extensions.shownSelectionUI", true);
user_pref("extensions.ui.locale.hidden", true);
user_pref("loop.copy.ticket", 196);
`;
			let addition = `user_pref("extensions.zotero.dataDir", "${newDir}");
user_pref("extensions.zotero.lastDataDir", "${newDir}");
user_pref("extensions.zotero.useDataDir", true);
`;
			
			await Zotero.File.putContentsAsync(prefsFile, contents);
			await Zotero.Profile.updateProfileDataDirectory(
				OS.Path.join(tmpDir, "Profiles", profile1),
				oldDir,
				newDir
			);
			
			let newContents = await Zotero.File.getContentsAsync(prefsFile);
			
			assert.equal(newContents, contents + addition);
		});
		
		
		it("should replace existing lines in prefs.js", async function () {
			let prefsFile = OS.Path.join(tmpDir, "Profiles", profile1, "prefs.js");
			let oldDir = OS.Path.join(OS.Path.dirname(tmpDir), "Old", "Zotero");
			let newDir = OS.Path.join(OS.Path.dirname(tmpDir), "New", "Zotero");
			
			let contents = `user_pref("extensions.lastAppVersion", "50.0");
user_pref("extensions.shownSelectionUI", true);
user_pref("extensions.zotero.dataDir", "old-mac-persistent-descriptor");
user_pref("extensions.zotero.lastDataDir", "${oldDir}");
user_pref("extensions.zotero.useDataDir", true);
user_pref("extensions.ui.locale.hidden", true);
user_pref("loop.copy.ticket", 196);
`;
			let expectedContents = `user_pref("extensions.lastAppVersion", "50.0");
user_pref("extensions.shownSelectionUI", true);
user_pref("extensions.ui.locale.hidden", true);
user_pref("loop.copy.ticket", 196);
user_pref("extensions.zotero.dataDir", "${newDir}");
user_pref("extensions.zotero.lastDataDir", "${newDir}");
user_pref("extensions.zotero.useDataDir", true);
`;
			
			await Zotero.File.putContentsAsync(prefsFile, contents);
			await Zotero.Profile.updateProfileDataDirectory(
				OS.Path.join(tmpDir, "Profiles", profile1),
				oldDir,
				newDir
			);
			
			let newContents = await Zotero.File.getContentsAsync(prefsFile);
			
			assert.equal(newContents, expectedContents);
		});
	});
});

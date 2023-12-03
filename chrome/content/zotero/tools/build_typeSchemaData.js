var { FilePicker } = ChromeUtils.importESModule('chrome://zotero/content/modules/filePicker.mjs');

(async function () {
    // Create schema
    var schema = {"itemTypes":{}, "creatorTypes":{}, "fields":{}};
    var types = Zotero.ItemTypes.getTypes();

    var fieldIDs = await Zotero.DB.columnQueryAsync("SELECT fieldID FROM fieldsCombined");
    var baseMappedFields = Zotero.ItemFields.getBaseMappedFields();
    
    for (let fieldID of fieldIDs) {
        var fieldObj = [/* name */Zotero.ItemFields.getName(fieldID)];
        try {
            // localizedString
            let str = Zotero.getString("itemFields." + fieldObj.name);
            if (str == "itemFields." + fieldObj.name) {
                // Use name for localizedString
                str = fieldObj[0];
            }
            fieldObj.push(str);
        } catch(e) {
            fieldObj.push(/* name -> localizedString */fieldObj[0]);
        }
        fieldObj.push(/* isBaseField */ !baseMappedFields.includes(fieldID));
        schema.fields[fieldID] = fieldObj;
    }

    // names, localizedStrings, creatorTypes, and fields for each item type
    for (let type of types) {
        var fieldIDs = Zotero.ItemFields.getItemTypeFields(type.id);
        var baseFields = {};
        for (let fieldID of fieldIDs) {
            if (baseMappedFields.includes(fieldID)) {
                baseFields[fieldID] = Zotero.ItemFields.getBaseIDFromTypeAndField(type.id, fieldID);
            }
        }

        var icon = Zotero.ItemTypes.getImageSrc(type.name);
        icon = icon.substr(icon.lastIndexOf("/")+1);

        try {
            var creatorTypes = Zotero.CreatorTypes.getTypesForItemType(type.id).map((creatorType) => creatorType.id);
        } catch (e) {
            creatorTypes = [];
        }
        var primaryCreatorType = Zotero.CreatorTypes.getPrimaryIDForType(type.id);
        if(creatorTypes[0] != primaryCreatorType) {
            creatorTypes.splice(creatorTypes.indexOf(primaryCreatorType), 1);
            creatorTypes.unshift(primaryCreatorType);
        }

        schema.itemTypes[type.id] = [
                        /* name */type.name,
                        /* localizedString */Zotero.ItemTypes.getLocalizedString(type.name),
                        /* creatorTypes */creatorTypes,
                        /* fields */ fieldIDs,
                        /* baseFields */baseFields,
                        /* icon */icon
        ];

    }

    var types = Zotero.CreatorTypes.getTypes();
    for (let type of types) {
        schema.creatorTypes[type.id] = [
                        /* name */type.name,
                        /* localizedString */Zotero.CreatorTypes.getLocalizedString(type.name)
        ];
    }

    // Write to file
    var fp = new FilePicker();
    fp.init(window, Zotero.getString('dataDir.selectDir'), fp.modeGetFolder);
    
    let resultElem = document.getElementById('result');
    if (await fp.show() != fp.returnOK) {
        resultElem.innerHTML = '<p>Failed.</p>';
    } else {
        let schemaFile = Zotero.File.pathToFile(fp.file);
        schemaFile.append("zoteroTypeSchemaData.js");
        await Zotero.File.putContentsAsync(
            schemaFile,
            `var ZOTERO_TYPE_SCHEMA = ${JSON.stringify(schema)};\n\n`
                 + "if (typeof module !== 'undefined') {\n\tmodule.exports = ZOTERO_TYPE_SCHEMA;\n}\n"
        );
        resultElem.innerHTML = `<p>Wrote ${schemaFile.path} successfully.</p>`;
    }
})();
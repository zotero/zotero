var ScholarLocalizedStrings;
var thisRow;
var dynamicBox;

function init()
{
	thisRow = window.arguments[0];
	dynamicBox = document.getElementById('dynamic-fields');
	ScholarLocalizedStrings = document.getElementById('scholar-strings');

	//universal fields
	var fieldNames = new Array("title","dateAdded","dateModified","source","rights");

	//add specific fields for this object type
	var fields = Scholar.ObjectFields.getObjectTypeFields(thisRow.getField("objectTypeID"));
	for(var i = 0; i<fields.length; i++)
		fieldNames.push(Scholar.ObjectFields.getName(fields[i]));

	//Add each
	for(var i = 0; i<fieldNames.length; i++)
	{
		var label = document.createElement("label");
		label.setAttribute("value",ScholarLocalizedStrings.getString("objectFields."+fieldNames[i])+":");
		label.setAttribute("control","dynamic-field-"+i);
		
		var valueElement = document.createElement("textbox");
		valueElement.setAttribute("value",thisRow.getField(fieldNames[i]));
		valueElement.setAttribute("id","dynamic-field-"+i);
		//valueElement.setAttribute("fieldName",fieldNames[i])
		
		var row = document.createElement("row");
		row.appendChild(label);
		row.appendChild(valueElement);
		dynamicBox.appendChild(row);

	}
	
	var beforeField = dynamicBox.firstChild;
	beforeField = beforeField.nextSibling;
	
	for (var i=0,len=thisRow.numCreators(); i<len; i++)
	{
		var creator = thisRow.getCreator(i);
		
		var label = document.createElement("label");
		label.setAttribute("value","Creator:");
		label.setAttribute("control","dynamic-creator-"+i);

		var valueElement = document.createElement("textbox");
		valueElement.setAttribute("value",creator.lastName+", "+creator.firstName);
		valueElement.setAttribute("id","dynamic-field-"+i);
		
		var row = document.createElement("row");
		row.appendChild(label);
		row.appendChild(valueElement);
		
		dynamicBox.insertBefore(row, beforeField);
	}
}

function doOK()
{
	return true;
}

function doCancel()
{
	return true;
}
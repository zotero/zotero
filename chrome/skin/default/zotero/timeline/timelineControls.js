var localeBundle = initLocaleBundle();
var jumpToYearTimer;
var lastJumpToYearValue;

/*
 * Set up the localization string bundle from timeline.properties
 */
function initLocaleBundle() {
	var src = 'chrome://zotero/locale/timeline.properties';
	var stringBundleService = Components.classes["@mozilla.org/intl/stringbundle;1"]
		.getService(Components.interfaces.nsIStringBundleService);
	return stringBundleService.createBundle(src);
}

/*
 * Get a localized string from the string bundle
 *
 * This is copied from zotero.js
 */
function getString(name, params){
	try {
		if (params != undefined){
			if (typeof params != 'object'){
				params = [params];
			}
			var l10n = localeBundle.formatStringFromName(name, params, params.length);
		}
		else {
			var l10n = localeBundle.GetStringFromName(name);
		}
	}
	catch (e){
		throw ('Localized string not available for ' + name);
	}
	return l10n;
}


function getTimeline() {
	var tt = getHeight();
	tt -= 165;
	if (tt < 100) {
		tt = 100;
	}
	return '<div class="timeline" id="my-timeline" style="height: ' + tt + 'px; border: 1px solid #aaa"></div>';
}

function getHeight() {
	var temp = document.documentElement.clientHeight;
	if(temp && temp > 0) {
		return temp;
	}
	else {
		temp=document.body.clientHeight;
		if(temp && temp > 0) {
			return temp;
		}
	}
	return 0;
}

function wasChanged(current) {
	if (current != lastJumpToYearValue) {
		lastJumpToYearValue = current;
		var theYear = document.getElementById("jumpYear").value;
		if(theYear.length == 0) {
			centerTimeline(new Date());
		}
		else {
			checkDate(theYear);
		}
	}
}

function doKeyPress(e)
{
	clearTimeout(jumpToYearTimer);
	lastJumpToYearValue = document.getElementById('jumpYear').value;
	if((e.which == '8' || e.which == '0') && lastJumpToYearValue.length == 0) {
		centerTimeline(new Date());
	}
	else if(e.which == '13'){
		checkDate(lastJumpToYearValue);
	}
	else {
		jumpToYearTimer = setTimeout(function () {
			wasChanged(document.getElementById("jumpYear").value);
		}, 1000)
	}
}

function getMonthNum(month) {
	var months = new Array('jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec');
	var num = months.indexOf(month.toLowerCase());
	if(num<0){
		num = 0;
	}
	return num;
}

function createDate(date){
	date = date.split('.');
	var theDate = new Date();
	theDate.setMonth(getMonthNum(date[0]));
	theDate.setDate(date[1]);
	theDate.setFullYear(date[2]);
	return theDate;
}

function getTimelineDate(timeline){
	var timelineDate = timeline.getBand(0).getCenterVisibleDate().toString();
	var dateParts = timelineDate.split(' ');
	timelineDate = dateParts[1] + '.' + dateParts[2] + '.' + dateParts[3];
	return timelineDate;
}

function checkDate(date) {
	var arr = new Array();
	var i = 0;
	date = date.replace(/[\s|.]/g,'');

	//check to see if the year is B.C.
	var bc = false;
	if (date.substr(date.length - 2).toLowerCase() == 'bc') {
		bc = true;
		date = date.substr(0, date.length - 2);
	}
	
	if(/\D/.test(date)) {
		return;
	}
	
	if (bc) {
		if(date < 10000) {
			centerTimeline(date + ' BC');
		}
	}
	else {
		if(date < 275000) {
			centerTimeline(date);
		}
	}
}
function changeBand(queryString, band, intervals, selectedIndex) {
	var values = new Array('d', 'm', 'y', 'e', 'c', 'i');
	
	var newIntervals = '';
	for (var i = 0; i < intervals.length; i++) {
		if (i == band) {
			newIntervals += values[selectedIndex];
		}
		else {
			newIntervals += intervals[i];
		}
	}
	
	window.location.search = queryString + 'i=' + newIntervals;
}

function createOption(t, selected) {
	var option = document.createElement("option");
	if (selected) {
		option.selected = "true";
	}
	var text = document.createTextNode(t);
	option.setAttribute("value", t);
	option.appendChild(text);
	return option;
}

function getFull(a) {
	switch (a) {
		case 'd':
			return getString("interval.day");
		case 'm':
			return getString("interval.month");
		case 'y':
			return getString("interval.year");
		case 'e':
			return getString("interval.decade");
		case 'c':
			return getString("interval.century");
		case 'i':
			return getString("interval.millennium");
		default:
			return false;
	}
}

function createQueryString(theQueryValue, except, timeline) {
	var temp = '';
	for(var i in theQueryValue) {
		if(except != i) {
			temp += i + '=' + theQueryValue[i] + '&';
		}
	}
	if(except != 'd') {
		temp += 'd=' + getTimelineDate(timeline) + '&';
	}
	//remove last & if no exceptions
	if(!except) {
		temp = temp.substr(0, temp.length -1)
	}
	return temp;
}

function setupOtherControls(div, timeline, queryString) {
	var table = document.createElement("table");
	
	var defaultQueryValue = new Object();
		defaultQueryValue['i'] = 'mye';
		defaultQueryValue['t'] = 'd';
		
	var theQueryValue = new Object;
	
	if (queryString) {
		var queryVars = queryString.split('&');
		for (var i in queryVars) {
			var [key, val] = queryVars[i].split('=');
			if(val) {
				switch (key) {
					case 'i':
						theQueryValue['i'] = val;
						break;
					case 't':
						theQueryValue['t'] = val;
						break;
				}
			}
		}
	}

	var intervals = (theQueryValue['i']) ? theQueryValue['i'] : defaultQueryValue['i'];
	if (intervals.length < 3) {
		intervals += defaultQueryValue['i'].substr(intervals.length);
	}
	var dateType = (theQueryValue['t']) ? theQueryValue['t'] : defaultQueryValue['t'];
	if(dateType != 'da' && dateType != 'dm') {
		dateType = defaultQueryValue['t'];
	}
	
	var tr = table.insertRow(0);
	
	var td = tr.insertCell(0);
	td.innerHTML = getString("general.jumpToYear");
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = getString("general.firstBand");
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = getString("general.secondBand");;
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = getString("general.thirdBand");;
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = getString("general.dateType");;
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = getString("general.timelineHeight");;

	tr = table.insertRow(1);
	tr.style.verticalAlign = "top";
	
	td = tr.insertCell(0);
	var input = document.createElement("input");
	input.type = "text";
	input.size = "15";
	input.id = "jumpYear";
	input.onkeypress=doKeyPress;
	td.appendChild(input);
	
	var options = new Array(getString("interval.day"), getString("interval.month"), getString("interval.year"),
		getString("interval.decade"), getString("interval.century"), getString("interval.millennium"));
	var selected = '';
	var theSelects = new Array();
	
	td = tr.insertCell(tr.cells.length);
	
	var select1 = document.createElement("select");
	selected = getFull(intervals[0]);
	for (var i = 0; i < options.length; i++) {
		select1.appendChild(createOption(options[i],(options[i] == selected)));
	}
	select1.onchange = function () {
		changeBand(createQueryString(theQueryValue, 'i', timeline), 0, intervals, table.rows[1].cells[1].firstChild.selectedIndex);
	};
	td.appendChild(select1);
	
	td = tr.insertCell(tr.cells.length);
	
	var select2 = document.createElement("select");
	selected = getFull(intervals[1]);
	for (var i = 0; i < options.length; i++) {
		select2.appendChild(createOption(options[i],(options[i] == selected)));
	}
	select2.onchange = function () {
		changeBand(createQueryString(theQueryValue, 'i', timeline), 1, intervals, table.rows[1].cells[2].firstChild.selectedIndex);
	};
	td.appendChild(select2);
	
	td = tr.insertCell(tr.cells.length);
	
	var select3 = document.createElement("select");
	selected = getFull(intervals[2]);
	for (var i = 0; i < options.length; i++) {
		select3.appendChild(createOption(options[i],(options[i] == selected)));
	}
	select3.onchange = function () {
		changeBand(createQueryString(theQueryValue, 'i', timeline), 2, intervals, table.rows[1].cells[3].firstChild.selectedIndex);
	};
	td.appendChild(select3);
	
	
	td = tr.insertCell(tr.cells.length);
	options = new Array(getString("dateType.published"), Zotero.getString("itemFields.dateAdded"), getString("dateType.modified"));
	var values = new Array('d', 'da', 'dm');
	var select4 = document.createElement("select");
		
	for (var i = 0; i < options.length; i++) {
		select4.appendChild(createOption(options[i],(values[i] == dateType)));
	}
	select4.onchange = function () {
		window.location.search = createQueryString(theQueryValue, 't', timeline) + 't=' + values[table.rows[1].cells[4].firstChild.selectedIndex];
	};
	td.appendChild(select4);
	
	td = tr.insertCell(tr.cells.length);
	var fitToScreen = document.createElement("button");
	fitToScreen.innerHTML = getString("general.fitToScreen");
	Timeline.DOM.registerEvent(fitToScreen, "click", function () {
		window.location.search = createQueryString(theQueryValue, false, timeline);
	});
	td.appendChild(fitToScreen);
	
	div.appendChild(table);
}

/*
	Everything below is from http://simile.mit.edu/timeline/examples/examples.js unless noted otherwise
*/

function centerTimeline(date) {
	tl.getBand(0).setCenterVisibleDate(Timeline.DateTime.parseGregorianDateTime(date));
}

function setupFilterHighlightControls(div, timeline, bandIndices, theme) {
	var table = document.createElement("table");
	var tr = table.insertRow(0);
	
	var td = tr.insertCell(0);
	td.innerHTML = getString("general.filter");
	
	td = tr.insertCell(1);
	td.innerHTML = getString("general.highlight");
	
	var handler = function(elmt, evt, target) {
		onKeyPress(timeline, bandIndices, table);
	};
	
	tr = table.insertRow(1);
	tr.style.verticalAlign = "top";
	
	td = tr.insertCell(0);
	
	var input = document.createElement("input");
	input.type = "text";
	input.size = "18";//Added by Ben for Zotero
	Timeline.DOM.registerEvent(input, "keypress", handler);
	td.appendChild(input);
	
	for (var i = 0; i < theme.event.highlightColors.length; i++) {
		td = tr.insertCell(i + 1);
		
		input = document.createElement("input");
		input.type = "text";
		Timeline.DOM.registerEvent(input, "keypress", handler);
		td.appendChild(input);
		input.size = "15";//Added by Ben for Zotero
		var divColor = document.createElement("div");
		divColor.style.height = "0.5em";
		divColor.style.background = theme.event.highlightColors[i];
		td.appendChild(divColor);
	}
	
	td = tr.insertCell(tr.cells.length);
	var button = document.createElement("button");
	button.innerHTML = getString("general.clearAll");
	Timeline.DOM.registerEvent(button, "click", function() {
		clearAll(timeline, bandIndices, table);
	});
	td.appendChild(button);
	
	div.appendChild(table);
}

var timerID = null;
function onKeyPress(timeline, bandIndices, table) {
	if (timerID != null) {
		window.clearTimeout(timerID);
	}
	timerID = window.setTimeout(function() {
		performFiltering(timeline, bandIndices, table);
	}, 300);
}
function cleanString(s) {
	return s.replace(/^\s+/, '').replace(/\s + $/, '');
}
function performFiltering(timeline, bandIndices, table) {
	timerID = null;
	
	var tr = table.rows[1];
	var text = cleanString(tr.cells[0].firstChild.value);
	
	var filterMatcher = null;
	if (text.length > 0) {
		var regex = new RegExp(text, "i");
		filterMatcher = function(evt) {
			return regex.test(evt.getText()) || regex.test(evt.getDescription());
		};
	}
	
	var regexes = [];
	var hasHighlights = false;
	for (var x = 1; x < tr.cells.length - 1; x++) {
		var input = tr.cells[x].firstChild;
		var text2 = cleanString(input.value);
		if (text2.length > 0) {
			hasHighlights = true;
			regexes.push(new RegExp(text2, "i"));
		} else {
			regexes.push(null);
		}
	}
	var highlightMatcher = hasHighlights ? function(evt) {
		var text = evt.getText();
		var description = evt.getDescription();
		for (var x = 0; x < regexes.length; x++) {
			var regex = regexes[x];
			if (regex != null && (regex.test(text) || regex.test(description))) {
				return x;
			}
		}
		return -1;
	} : null;
	
	for (var i = 0; i < bandIndices.length; i++) {
		var bandIndex = bandIndices[i];
		timeline.getBand(bandIndex).getEventPainter().setFilterMatcher(filterMatcher);
		timeline.getBand(bandIndex).getEventPainter().setHighlightMatcher(highlightMatcher);
	}
	timeline.paint();
}
function clearAll(timeline, bandIndices, table) {
	var tr = table.rows[1];
	for (var x = 0; x < tr.cells.length - 1; x++) {
		tr.cells[x].firstChild.value = "";
	}
	
	for (var i = 0; i < bandIndices.length; i++) {
		var bandIndex = bandIndices[i];
		timeline.getBand(bandIndex).getEventPainter().setFilterMatcher(null);
		timeline.getBand(bandIndex).getEventPainter().setHighlightMatcher(null);
	}
	timeline.paint();
}
var localeHash = getLocaleHash();

function getLocaleHash() {
	var localeHash = new Object();
	var content = getContentsFromURL("chrome://zotero/locale/timeline.properties");
	var m;
	while(m = /^[\S]+(?=\s*=)/gm.exec(content)) {
		localeHash[m] = /=[^\n]+/g.exec(content).toString().replace(/=\s*/,'');;
	}
	return localeHash;
}

function getContentsFromURL(url) {
	var xmlhttp = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
					.createInstance();
	xmlhttp.open('GET', url, false);
	xmlhttp.send(null);
	return xmlhttp.responseText;
}


function getTimeline() {
	var tt = getHeight();
	tt -= 180;
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

function doReturn(e)
{
	if(e.which)	{
		if(e.which == '13'){
			checkDate(document.getElementById('jumpYear').value);
		}
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
		return false;
	}
	
	if (bc) {
		centerTimeline(date + ' BC');
	}
	else {
		centerTimeline(date);
	}
}
function changeBand(band, intervals, date, url, selectedIndex) {
	var values = new Array('d', 'm', 'y', 'e', 'c', 'i');
	var temp = url.split('/');
	
	var newIntervals = '';
	for (var i = 0; i < intervals.length; i++) {
		if (i == band) {
			newIntervals += values[selectedIndex];
		}
		else {
			newIntervals += intervals[i];
		}
	}
	temp[3] = newIntervals;
	temp[4] = date;
	window.location = temp.join('/');
}

function changeDateType(url, intervals, values, date, seletedIndex) {
	var temp = url.split('/');
	temp[3] = intervals;
	temp[4] = date;
	temp[5] = values[seletedIndex];
	window.location = temp.join('/');
}

function createOption(t, selected) {
	option = document.createElement("option");
	if (selected) {
		option.selected = "true";
	}
	text = document.createTextNode(t);
	option.setAttribute("value", t);
	option.appendChild(text);
	return option;
}

function getFull(a) {
	switch (a) {
		case 'd':
			return localeHash["interval.day"];
		case 'm':
			return localeHash["interval.month"];
		case 'y':
			return localeHash["interval.year"];
		case 'e':
			return localeHash["interval.decade"];
		case 'c':
			return localeHash["interval.century"];
		case 'i':
			return localeHash["interval.millennium"];
		default:
			return false;
	}
}

function setupOtherControls(div, timeline, url) {
	var table = document.createElement("table");
	
	// url=  zotero://timeline/intervals/timelineDate/dateType/type/ids/
	var parts = url.split('/');
	var intervals = parts[3];
	if (intervals.length < 3) {
		intervals += "mye".substr(intervals.length);
	}
	var tr = table.insertRow(0);
	
	var td = tr.insertCell(0);
	td.innerHTML = localeHash["general.jumpToYear"];
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = localeHash["general.firstBand"];
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = localeHash["general.secondBand"];;
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = localeHash["general.thirdBand"];;
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = localeHash["general.dateType"];;
	td = tr.insertCell(tr.cells.length);
	td.innerHTML = localeHash["general.timelineHeight"];;

	tr = table.insertRow(1);
	tr.style.verticalAlign = "top";
	
	td = tr.insertCell(0);
	var input = document.createElement("input");
	input.type = "text";
	input.size = "15";
	input.id="jumpYear";
	input.onkeypress=doReturn;
	td.appendChild(input);
	
	var options = new Array(localeHash["interval.day"], localeHash["interval.month"], localeHash["interval.year"],
		localeHash["interval.decade"], localeHash["interval.century"], localeHash["interval.millennium"]);
	var selected = '';
	var theSelects = new Array();
	
	td = tr.insertCell(tr.cells.length);
	
	var select1 = document.createElement("select");
	selected = getFull(intervals[0]);
	for (var i = 0; i < options.length; i++) {
		select1.appendChild(createOption(options[i],(options[i] == selected)));
	}
	select1.onchange = function () {
		changeBand(0, intervals, getTimelineDate(timeline), url, table.rows[1].cells[1].firstChild.selectedIndex);
	};
	td.appendChild(select1);
	
	td = tr.insertCell(tr.cells.length);
	
	var select2 = document.createElement("select");
	selected = getFull(intervals[1]);
	for (var i = 0; i < options.length; i++) {
		select2.appendChild(createOption(options[i],(options[i] == selected)));
	}
	select2.onchange = function () {
		changeBand(1, intervals, getTimelineDate(timeline), url, table.rows[1].cells[2].firstChild.selectedIndex);
	};
	td.appendChild(select2);
	
	td = tr.insertCell(tr.cells.length);
	
	var select3 = document.createElement("select");
	selected = getFull(intervals[2]);
	for (var i = 0; i < options.length; i++) {
		select3.appendChild(createOption(options[i],(options[i] == selected)));
	}
	select3.onchange = function () {
		changeBand(2, intervals, getTimelineDate(timeline), url, table.rows[1].cells[3].firstChild.selectedIndex);
	};
	td.appendChild(select3);
	
	td = tr.insertCell(tr.cells.length);
	options = new Array(localeHash["dateType.published"], localeHash["dateType.added"], localeHash["dateType.modified"]);
	var values = new Array('date', 'dateAdded', 'dateModified');
	var select4 = document.createElement("select");
	selected = 0;
	if (parts[5]) {
		selected = values.indexOf(parts[5]);
	}
	if (selected < 0) {
		selected = 0;
	}
	
	for (var i = 0; i < options.length; i++) {
		select4.appendChild(createOption(options[i],(i == selected)));
	}
	select4.onchange = function () {
		changeDateType(url, intervals, values, getTimelineDate(timeline), table.rows[1].cells[4].firstChild.selectedIndex);
	};
	td.appendChild(select4);
	
	td = tr.insertCell(tr.cells.length);
	var fitToScreen = document.createElement("button");
	fitToScreen.innerHTML = localeHash["general.fitToScreen"];
	Timeline.DOM.registerEvent(fitToScreen, "click", function () {
		var temp = url.split('/');
		temp[3] = intervals;
		temp[4] = getTimelineDate(timeline);
		window.location = temp.join('/');
	});
	td.appendChild(fitToScreen);

	tr = table.insertRow(2);
	td = tr.insertCell(0);
	
	var button = document.createElement("button");
	button.innerHTML = localeHash["general.go"];
	Timeline.DOM.registerEvent(button, "click", function () {
		checkDate(table.rows[1].cells[0].firstChild.value);
	});
	td.appendChild(button);
	
	div.appendChild(table);
}

/*
	Everything below is from http://simile.mit.edu/timeline/examples/examples.js
*/

function centerTimeline(date) {
	tl.getBand(0).setCenterVisibleDate(Timeline.DateTime.parseGregorianDateTime(date));
}

function setupFilterHighlightControls(div, timeline, bandIndices, theme) {
	var table = document.createElement("table");
	var tr = table.insertRow(0);
	
	var td = tr.insertCell(0);
	td.innerHTML = localeHash["general.filter"];
	
	td = tr.insertCell(1);
	td.innerHTML = localeHash["general.highlight"];
	
	var handler = function (elmt, evt, target) {
		onKeyPress(timeline, bandIndices, table);
	};
	
	tr = table.insertRow(1);
	tr.style.verticalAlign = "top";
	
	td = tr.insertCell(0);
	
	input = document.createElement("input");
	input.type = "text";
	input.size = "18";
	Timeline.DOM.registerEvent(input, "keypress", handler);
	td.appendChild(input);
	
	for (var i = 0; i < theme.event.highlightColors.length; i++) {
		td = tr.insertCell(i + 1);
		
		input = document.createElement("input");
		input.type = "text";
		Timeline.DOM.registerEvent(input, "keypress", handler);
		td.appendChild(input);
		input.size = "15";
		var divColor = document.createElement("div");
		divColor.style.height = "0.5em";
		divColor.style.background = theme.event.highlightColors[i];
		td.appendChild(divColor);
	}
	
	td = tr.insertCell(tr.cells.length);
	button = document.createElement("button");
	button.innerHTML = localeHash["general.clearAll"];
	Timeline.DOM.registerEvent(button, "click", function () {
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
	timerID = window.setTimeout(function () {
		performFiltering(timeline, bandIndices, table);
	}, 300);
}
function cleanString(s) {
	return s.replace(/^\s + /, '').replace(/\s + $/, '');
}
function performFiltering(timeline, bandIndices, table) {
	timerID = null;
	
	var tr = table.rows[1];
	var text = cleanString(tr.cells[0].firstChild.value);
	
	var filterMatcher = null;
	if (text.length > 0) {
		var regex = new RegExp(text, "i");
		filterMatcher = function (evt) {
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
	var highlightMatcher = hasHighlights ? function (evt) {
		var text = evt.getText();
		var description = evt.getDescription();
		for (var x = 0; x < regexes.length; x++) {
			var regex = regexes[x];
			if (regex != null && (regex.test(text) || regex.test(description))) {
				return x;
			}
		}
		return - 1;
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
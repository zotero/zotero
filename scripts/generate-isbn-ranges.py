#!/usr/bin/env python3

import urllib.request, sys, argparse, os, json, re
import xml.etree.ElementTree as ET

# Command line args
parser = argparse.ArgumentParser()
parser.add_argument("out_file", help='File to output to.', nargs="?")
args = parser.parse_args();

# Fetch ranges
# See https://www.isbn-international.org/range_file_generation
url = 'https://www.isbn-international.org/export_rangemessage.xml'
print('Fetching XML file from ' + url, file=sys.stderr)
rangesRoot = ET.parse(urllib.request.urlopen(url))
print('Done', file=sys.stderr)

# Make sure we're always dealing with integers, so that nothing breaks in unexpected ways
intRE = re.compile(r'^\d+$');

# Parse them into JSON
uniqueRanges = {}
sameRanges = {} # To reduce redundancy, we can alias same ranges
for group in rangesRoot.iter('Group'):
	(uccPrefix, groupPrefix) = group.find('Prefix').text.split('-')
	
	if not intRE.match(uccPrefix) or not intRE.match(groupPrefix):
		print("WARNING: Unexpected prefixes: " + uccPrefix + " " + groupPrefix,  file=sys.stderr)
		continue
	
	ranges = []
	for rule in group.iter('Rule'):
		length = int(rule.find('Length').text)
		if length <= 0: # 0 length means that the range has not been assigned yet
			continue
		
		range = rule.find('Range').text.split('-')
		if not intRE.match(range[0]) or not intRE.match(range[1]):
			print("WARNING: Unexpected range: " + range[0] + " " + range[1],  file=sys.stderr)
			continue
		
		ranges.append(range[0][:length])
		ranges.append(range[1][:length])
	
	if len(ranges) == 0:
		continue
	
	# In case this is out of order in the XML file
	# Sort ranges by string length first, then by numeric value
	# 0 9 00 09 100 0005
	ranges.sort(key=lambda x: str(len(x)) + '-' + x)
	
	key = '.'.join(ranges)
	if key in sameRanges:
		sameRanges[key].append([uccPrefix, groupPrefix])
	else:
		if uccPrefix not in uniqueRanges:
			uniqueRanges[uccPrefix] = {}
		
		uniqueRanges[uccPrefix][groupPrefix] = ranges
		sameRanges[key] = [[uccPrefix, groupPrefix]]


# Output to file as JavaScript
file = """/** THIS FILE WAS GENERATED AUTOMATICALLY **/

/**
 * ISBN Registrant ranges from https://www.isbn-international.org/range_file_generation
**/
Zotero.ISBN = {};
Zotero.ISBN.ranges = (function() {
	var ranges = """

rangesJSON = json.dumps(uniqueRanges, separators=(',', ': '), indent="\t", sort_keys=True)
rangesJSON = re.sub(r'(?<= \[|\d"|",)\s+', '', rangesJSON) # Remove newlines in ranges array
file += '\n\t'.join(rangesJSON.split('\n')) # Add extra indent
file += ";\n\t\n\t"

# For same ranges, don't duplicate data, just re-assign it
dupes = []
for _, ranges in sameRanges.items():
	if len(ranges) == 1:
		continue # No duplicates
	
	last = ranges.pop(0) # First range actually contains the value that needs to get assigned, so it needs to end up last
	ranges.sort(key=lambda r: '.'.join(r)) # Try to keep the list stable to keep the diff reasonable
	ranges.append(last)
	
	dupes.append(' = '.join(map(lambda r: "ranges['" + "']['".join(r) + "']", ranges)))

#try to keeps this as stable as possible
dupes.sort()
file += ";\n\t".join(dupes) + ";"

file += """
	
	return ranges;
})();"""


if args.out_file is not None:
	# Try printing to file if one is provided
	print('Writing ranges to ' + args.out_file, file=sys.stderr)

	f = open(args.out_file, 'w')
	print(file, file=f)
else:
	# Print to stdout
	print(file)
#!/usr/bin/python

import re

ifh = open("zotero.properties");
ofh = open("zotero.properties.NEW", "w+")

obj = {}

while 1:
    line = ifh.readline()
    if not line: break
    line = line.strip()
    try:
        key, val = re.split("\s*=\s*", line)
        obj[key] = val
    except:
        pass

lst = []
for key in obj:
    lst.append("%s =	%s" % (key,obj[key]))
def sortme(a, b):
    if a[0] > b[0]:
        return 1
    elif a[0] < b[0]:
        return -1
    else:
        return 0
lst.sort(sortme)

for line in lst:
    ofh.write("%s\n" % line)
    

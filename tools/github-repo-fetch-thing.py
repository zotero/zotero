#!/bin/env python

import json as simplejson
import cgi
import urllib
import datetime
import re

nowtime = datetime.datetime.now()
timestamp = nowtime.isoformat()

fs = cgi.FieldStorage()

payload = simplejson.loads(fs.getvalue('payload'))
paths = {}

for commit in payload['commits']:
    for path in commit['added']:
        paths[path] = True
    for path in commit['modified']:
        paths[path] = True

#    myout = open("/home/fbennett/public_html/cgi-bin/HERE.txt", "w+")
#    myout.write("Debug note\n")



for path in paths:
    if not path.startswith('mlz-') or not path.endswith('.csl') or not path.find('/') == -1:
        continue

    # fetch the files from GitHub
    fetcher = urllib.URLopener()
    ifh = fetcher.open("https://raw.github.com/fbennett/mlz-styles/master/%s" % (path,))
    content = ifh.read()
    ifh.close()

    # set timestamp
    content = re.sub('<updated>.*</updated>', '<updated>%s</updated>' % (timestamp,), content)

    # write file
    ofh = open("/home/fbennett/public_html/github/%s" % (path,), "w+")
    ofh.write(content)
    ofh.close()


## Formalities to complete the transaction ##

page = '''Content-type: text/html

<html>
<body>
<p>Success</p>
</body>
</html>
'''

print page

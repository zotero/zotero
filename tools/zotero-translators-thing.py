#!/usr/bin/python
# -*- encoding: utf-8 -*-

import MySQLdb,sys,os,re
import json as simplejson
from datetime import datetime
from zipfile import ZipFile
import elementtree.ElementTree as ET
from elementtree.ElementTree import dump
import cgi
import urllib

fs = cgi.FieldStorage()
now = datetime.now()
dbdate = now.strftime("%s")
filedate = now.strftime("%Y-%m-%d %H:%M:%S")
timestamp = now.isoformat()

db = MySQLdb.connect(host="localhost", user="fbennett_admin", passwd="cu4Quelph", port=3306, charset="utf8")
cur = db.cursor()
cur.execute("USE fbennett_translators")

stmt = '''
CREATE TABLE translators (
    translatorID CHAR(64) PRIMARY KEY,
    label VARCHAR(1024),
    target VARCHAR(4096),
    minVersion VARCHAR(64),
    maxVersion VARCHAR(64),
    priority INT,
    inRepository TINYINT,
    translatorType TINYINT NOT NULL,
    browserSupport VARCHAR(64),
    lastUpdated INT,
    translator MEDIUMBLOB NOT NULL,
    displayOptions VARCHAR(1024),
    configOptions VARCHAR(1024),
    xmlstring MEDIUMBLOB NOT NULL
);
'''

fields = ["translatorID", "label", "target", "minVersion", "maxVersion", "priority", "inRepository", "translatorType", "browserSupport", "lastUpdated", "translator", "displayOptions", "configOptions"]

def processContent(content, forcedate=None):
    m = re.match("^({.*?})[\n\r]+([^}].*)", content, re.M|re.S)
    open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("1: %s" % content)
    if m:
        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("2")

        metadata = simplejson.loads(m.group(1), encoding="utf-8")
        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("3")
        metadata["translator"] = m.group(2).strip("\n").decode("utf-8")
        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("4: %s" % metadata["translator"].encode("utf-8"))
        params = []
        for field in fields:

            if metadata.has_key(field):
                val = metadata[field]
                if forcedate and field == "lastUpdated":
                    val = filedate
                    metadata[field] = filedate
                if type(val) == type("string"):
                    val = val.encode("utf-8")
                if field == "configOptions":
                    val = simplejson.dumps(metadata["configOptions"], encoding="utf-8", ensure_ascii=False)
                if field == "displayOptions":
                    val = simplejson.dumps(metadata["displayOptions"], encoding="utf-8", ensure_ascii=False)
                params.append(val)
            else:
                params.append(None)

        # We now have the data. Let's build the XML
        #currtime = ET.SubElement(xml, "currentTime")
        #currtime.text = str(dbdate)

        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("5")
         
        # print metadata["label"].encode("utf8")

        translator = ET.Element("translator")
        translator.attrib["id"] = metadata["translatorID"]
        if metadata.has_key("lastUpdated"):
            translator.attrib["lastUpdated"] = metadata["lastUpdated"]
        if metadata.has_key("translatorType"):
            translator.attrib["type"] = str(metadata["translatorType"])
        if metadata.has_key("minVersion"):
            translator.attrib["minVersion"] = metadata["minVersion"]
        if metadata.has_key("maxVersion"):
            if not metadata["maxVersion"]:
                metadata["maxVersion"] = ""
            translator.attrib["maxVersion"] = metadata["maxVersion"]
        if metadata.has_key("browserSupport"):
	    translator.attrib["browserSupport"] = metadata["browserSupport"]
        if metadata.has_key("priority"):
            priority = ET.SubElement(translator, "priority")
            priority.text = str(metadata["priority"])
        if metadata.has_key("label"):
            label = ET.SubElement(translator, "label")
            label.text = metadata["label"]
        if metadata.has_key("displayOptions"):
            displayOptions = ET.SubElement(translator, "displayOptions")
            displayOptions.text = simplejson.dumps(metadata["displayOptions"], encoding="utf-8", ensure_ascii=False)
        if metadata.has_key("configOptions"):
            configOptions = ET.SubElement(translator, "configOptions")
            configOptions.text = simplejson.dumps(metadata["configOptions"], encoding="utf-8", ensure_ascii=False)
        if metadata.has_key("creator"):
            creator = ET.SubElement(translator, "creator")
            creator.text = metadata["creator"]
        if metadata.has_key("target"):
            creator = ET.SubElement(translator, "target")
            creator.text = metadata["target"]
        code = ET.SubElement(translator, "code")
        code.text = metadata["translator"]

        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("6")

        # Add the xml string to the array, and set the date as a number
        params.append(ET.tostring(translator, encoding="utf-8"))
        metadata["xmlstring"] = ET.tostring(translator, encoding="utf-8")
        m = re.match("([0-9]{4})-([0-9]{2})-([0-9]{2}) ([0-9]{2}):([0-9]{2}):([0-9]{2})", metadata["lastUpdated"])
        if m:
            dt = datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), int(m.group(4)), int(m.group(5)), int(m.group(6)))
            metadata["lastUpdated"] = dt.strftime("%s")
            params[9] = int(dt.strftime("%s"))

        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("7: %s\n" % len(params))

        cur.execute("SELECT COUNT(*) FROM translators WHERE translatorID=%s", metadata["translatorID"])
        haveit = cur.fetchone()[0]
        if haveit:
            cur.execute("DELETE FROM translators WHERE translatorID=%s", metadata["translatorID"])

        # For global forced updates
        #params[9] = int(dbdate)

        cur.execute("INSERT INTO translators VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)", params)

        mytranslator = metadata.pop("translator")
        metadata.pop("xmlstring")

        if forcedate:
            metadata["lastUpdated"] = forcedate
        else:
            metadata["lastUpdated"] = filedate

        json = simplejson.dumps(metadata, encoding="utf-8", ensure_ascii=False, indent=4)

        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("8: %s\n" % json.encode("utf-8"))

        return u"%s\n\n%s" % (json, mytranslator)

def processFiles():
    # If running as CGI, grab added and modified files and update in filesystem
    if len(sys.argv) == 1:
        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("HELLO\n")
        payload = simplejson.loads(fs.getvalue('payload'), encoding="utf-8")
        open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("PAYLOAD: %s\n" % payload)
        paths = {}
        for commit in payload['commits']:
            for path in commit['added']:
                paths[path] = True
            for path in commit['modified']:
                paths[path] = True
        for path in paths:
            path = path.strip()
            if not path.endswith('.js') or not path.find('/') == -1:
                continue
            # fetch the files from GitHub
            fetcher = urllib.URLopener()
            ifh = fetcher.open("https://raw.github.com/fbennett/translators/multi/%s" % (path,))
            content = ifh.read()
            ifh.close()

            # write file
            open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("-2")
            content = processContent(content, forcedate=filedate)
            content = content.encode("utf-8")
            #open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("-1")
            if content:
                ofh = open("/home/fbennett/public_html/translators/src/%s" % (path,), "w+")
                ofh.write(content)
                ofh.close()
            else:
                open("/home/fbennett/public_html/cgi-bin/WOW.txt", "w+").write("0 -- no error, no content")


    # Update the zip file in both modes
    myzip = ZipFile('/home/fbennett/public_html/translators/translators.zip', 'w')
    os.chdir("../translators/src")
    for filename in os.listdir("."):
        # If run as script with --init, write all files in filesystem to database
        if len(sys.argv) > 1 and sys.argv[1] == "--init":
            content = open("/home/fbennett/public_html/translators/src/%s" % filename).read()
            processContent(content)
        if len(sys.argv) > 1 and sys.argv[1] == "--init-force-to-utf8":
            print filename
            content = open("/home/fbennett/public_html/translators/src/%s" % filename).read()
            content = processContent(content, forcedate=filedate)
            if content:
                content = open("/home/fbennett/public_html/translators/src/%s" % filename, 
"w+").write(content.encode("utf-8"))
            else:
                print "    WARNING: translator had no content: %s" % filename
        myzip.write(filename)
    myzip.close()

if __name__ == "__main__":
    processFiles()
    db.close()

    if len(sys.argv) == 1 or True:

        ## Formalities to complete the transaction ##
        page = '''Content-type: text/html

<html>
<body>
<p>Success</p>
</body>
</html>
'''
        print page

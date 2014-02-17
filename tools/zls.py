#!/usr/bin/python

import os,sys
import sqlite3
from ConfigParser import ConfigParser
#from urllib import URLopener
import urllib

IANA = "http://www.iana.org/assignments/language-subtag-registry/language-subtag-registry"
ISO = "http://www.loc.gov/standards/iso639-2/ISO-639-2_utf-8.txt"

keynames = ['subtag', 'tag', 'type', 'suppressscript', 'scope', 'preferredvalue', 'macrolanguage', 'add', 'description', 'deprecated', 'comment', 'prefix'];

header = '''-- %s

-- This file is derived from the IANA Language Subtag Registry

DROP TABLE IF EXISTS zlsSubtagData;
DROP TABLE IF EXISTS zlsSubtags;
DROP TABLE IF EXISTS isoTagMap;

'''

zlsSubtagData = '''
CREATE TABLE zlsSubtagData (
	id INTEGER PRIMARY KEY,
	value TEXT
);
'''

zlsSubtags = '''
CREATE TABLE zlsSubtags (
	seq INTEGER PRIMARY KEY,
	subtag INT,
	tag INT,
	type INT,
	suppressscript INT,
	scope INT,
	preferredvalue INT,
	macrolanguage INT,
	added INT,
	description INT,
	deprecated INT,
	comment INT,
	prefix INT
);
'''

isoTagMap = '''
CREATE TABLE isoTagMap (
	iso TEXT PRIMARY KEY,
	iana TEXT
);
'''

class Database:

    def __init__(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute(zlsSubtagData) 
        self.db.execute(zlsSubtags) 
        self.db.execute(isoTagMap)
        self.count = 0
        self.seq = 0
        self.anyValToId = {}
        self.keyToId = {}

    def processEntry(self,tagDataSet):
        for label in tagDataSet:
            for strval in [label, tagDataSet[label]]:
                if type(strval) == type([]):
                    for mystrval in strval:
                        if not self.anyValToId.has_key(mystrval):
                            self.count += 1
                            self.anyValToId[mystrval] = self.count
                            self.db.execute("INSERT INTO zlsSubtagData VALUES (?,?)", (self.count,mystrval))
                else:
                    if not self.anyValToId.has_key(strval):
                        self.count += 1
                        self.anyValToId[strval] = self.count
                        self.db.execute("INSERT INTO zlsSubtagData VALUES (?,?)", (self.count,strval))

        self.seq += 1
        insertvals = [self.seq]
        prefixcount = 0
        for keyname in keynames:
            if not tagDataSet.has_key(keyname):
                insertvals.append(None)
                if keyname == 'prefix':
                    self.db.execute("INSERT INTO zlsSubtags VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);", insertvals);
            elif keyname == 'prefix':
                for item in tagDataSet['prefix']:
                    insertvals.append(self.anyValToId[tagDataSet[keyname][prefixcount]])
                    self.db.execute("INSERT INTO zlsSubtags VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?);", insertvals);
                    prefixcount += 1
                    self.seq += 1
                    insertvals[0] = self.seq
                    insertvals.pop()
            else:
                insertvals.append(self.anyValToId[tagDataSet[keyname]])

class Build(Database):

    def __init__(self):
        Database.__init__(self)
        opener = urllib.URLopener()
        spath = os.getcwd()
        sname = os.path.splitext(os.path.split(sys.argv[0])[-1])[0]
        print sname
        # input = os.path.join(spath, "%s.txt" % (sname,))
        self.dumpfile = os.path.join(spath, "%s.sql" % (sname,))

        #if not os.path.exists(input):
        #    print "\nUsage: %s.py" % sname
        #    print "\n  A file %s.txt should be located in the same directory as" %sname
        #    print "  the script, and should be a copy of the IANA Language"
        #    print "  Subtag registry."
        #    print "\n  Output will be placed in %s.sql\n" % sname
        #    sys.exit()

        print "Opening %s" % ISO
        ifh = opener.open(ISO)
        sql = 'INSERT INTO isoTagMap VALUES (?,?)'
        while 1:
            line = ifh.readline()
            if not line: break
            if line.startswith("\xef\xbb\xbf"):
                line = line[3:]
            line = line.split("|")
            if line[2]:
                self.db.execute(sql, [line[0], line[2]])
                if line[1]:
                    self.db.execute(sql, [line[1], line[2]])

        print "Opening %s" % IANA
        ifh = opener.open(IANA)
        tagDataSet = {}
        skip = False
        while 1:
            line = ifh.readline()
            if not line: break
            line = line.decode('utf8').rstrip()
            pos = line.find(":")
            if pos > -1 and line[:pos].find(" ") == -1:
                key = line[:pos].lower().replace('-','')
                val = line[pos+1:].strip()
                if key == 'filedate':
                    self.filedate = val.replace('-','')
                    # This can go away after the next IANA update
                    #if self.filedate == '20100817':
                    #    self.filedate = '2010821'
                    #skip = True
                    #continue
                if key == "description":
                    if tagDataSet.has_key('description'):
                        continue
                if key == 'prefix':
                    if not tagDataSet.has_key('prefix'):
                        tagDataSet['prefix'] = []
                    tagDataSet['prefix'].append(val)
                else:
                    tagDataSet[key] = val
            elif line[0] == " ":
                tagDataSet[key] += " %s" % (line,)
            elif line == "%%":
                if skip:
                    skip = False
                    continue
                self.processEntry(tagDataSet)
                tagDataSet = {}
        self.processEntry(tagDataSet)
        print "Opening %s" % self.dumpfile
        with open(self.dumpfile, 'w') as f:
            f.write(header % self.filedate);
            for line in self.db.iterdump():
                if line.startswith('BEGIN'):
                    continue
                if line.startswith('COMMIT'):
                    continue
                f.write('%s\n' % line.encode('utf8'))
        


if __name__ == '__main__':
    Build()

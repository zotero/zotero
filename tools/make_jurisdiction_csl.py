#!/usr/bin/python

import sys,os,json

ifh = open("/home/bennett/src/mlz-jurisdictions/jurisdictions.json")
json = json.load(ifh)
ifh.close()


header = '''namespace cs = "http://purl.org/net/xbiblio/csl"

div {
    jurisdictions =
        '''

# For each entry we generate:
# - UI string
# - key

class JurisdictionEngine:

    def __init__(self):
        self.lst = []

    def extract(self, obj, suffix=None):
        strs = []
        for key in obj:
            if suffix:
                uistr = "%s, %s" % (obj[key]["name"],suffix)
            else:
                uistr = obj[key]["name"]
            strs.append("\"%s\"" % (key,))
            if obj[key].has_key("subunit"):
                if obj[key]["subunit"]["name"]:
                    mysuffix = "%s (%s)" % (obj[key]["nickname"],obj[key]["subunit"]["name"])
                else:
                    mysuffix = obj[key]["nickname"]
                self.extract(obj[key]["subunit"]["children"], suffix=mysuffix)
            if obj[key].has_key("federal"):
                if obj[key]["federal"]["name"]:
                    mysuffix = "%s (%s)" % (obj[key]["nickname"],obj[key]["federal"]["name"])
                else:
                    mysuffix = obj[key]["nickname"]
                self.extract(obj[key]["federal"]["children"], suffix=mysuffix)

        self.lst.extend(strs)

    def dump(self):
        self.lst.sort()
        sys.stdout.write(header)
        print "\n        | ".join(self.lst)
        print "}"

if __name__ == "__main__":
    
    extractor = JurisdictionEngine()
    extractor.extract(json)
    extractor.dump()


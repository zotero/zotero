#!/usr/bin/python

import sys,os,json

reload(sys)
sys.setdefaultencoding("utf-8") # Needs Python Unicode build !

ifh = open("/home/bennett/src/mlz-jurisdictions/jurisdictions.json")
json = json.load(ifh)
ifh.close()

# For each entry we generate:
# - UI string
# - key

class JurisdictionEngine:

    def extract(self, obj, suffix=""):
        strs = []
        for key in obj:
            if suffix:
                uistr = "%s, %s" % (obj[key]["name"],suffix)
            else:
                uistr = obj[key]["name"]
            strs.append("INSERT INTO jurisdictions VALUES(\"%s\",\"%s\");" % (key,uistr.replace("'","")))
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
        strs.sort()
        for s in strs:
            print s

if __name__ == "__main__":
    
    extractor = JurisdictionEngine()
    extractor.extract(json)



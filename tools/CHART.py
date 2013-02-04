#!/usr/bin/python

import sys,os,re,csv

os.chdir(os.path.dirname(sys.argv[0]))
os.chdir("mlz");

# Make me a sort function
def sortFunction (a,b):
    if int(a["last-date-value"]) > int(b["last-date-value"]):
        return 1
    elif int(a["last-date-value"]) < int(b["last-date-value"]):
        return -1
    else:
        return 0


# For each country across the data set, open an array keyed to its country code,
# and write in the country name and total number of unique downloads.
#
# Make a list of sampling dates in the process.
countries = {}
dates = []
filenames = []
countrycodes = []
for i in os.listdir("."):
    filenames.append(i)
filenames.sort()
for i in filenames:
    m = re.match(".*([0-9]{4})-([0-9]{2})-([0-9]{2})", i)
    if m:
        date = "%s-%s-%s" % (m.group(1), m.group(2), m.group(3))
        print date
        dates.append(date)
        ifh = open(i)
        data_in = csv.reader(ifh)
        for row in data_in:
            if not countries.has_key(row[2]):
                countries[row[2]] = {}
                countries[row[2]]["values"] = {}
                countrycodes.append(row[2])
            countries[row[2]]["name"] = row[0]
            countries[row[2]]["values"][date] = row[1]
        ifh.close()
countrycodes.sort()

# Revisit each date in the samples list, and write in a zero
# placeholder where data is lacking, saving the last
# date in a special field
dates.sort()
for d in dates:
    for c in countries:
        if not countries[c]["values"].has_key(d):
            countries[c]["values"][d] = "0"
        countries[c]["last-date-value"] = countries[c]["values"][d]

# Compose a list, with the packets of
# country information as items
countrylist = []
for c in countries:
    countrylist.append(countries[c])

# Sort the list by the number of entries in
# the last date
countrylist.sort(sortFunction)
countrylist.reverse()

# Spit out the data as CSV.
ofh = open("aggregates.csv", "w+")
data_out = csv.writer(ofh)
firstrow = [""]
allrows = []
for c in countrylist:
    firstrow.append(c["name"])
allrows.append(firstrow)
for d in dates:
    row = []
    row.append(d)
    for c in countrylist:
        row.append(c["values"][d])
    allrows.append(row)
data_out.writerows(allrows)
ofh.close()

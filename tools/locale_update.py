#!/usr/bin/python2.7

from ZoteroLocaleMerge import ZoteroLocaleMerge
import os
merger = ZoteroLocaleMerge()

print "Merging locales ..."
merger.merge()
print "  done"

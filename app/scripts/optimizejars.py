# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is mozilla.org code
#
# The Initial Developer of the Original Code is
# Mozilla Foundation.
# Portions created by the Initial Developer are Copyright (C) 2010
# the Initial Developer. All Rights Reserved.
#
# Contributor(s):
#   Taras Glek <tglek@mozilla.com>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the GPL or the LGPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
# ***** END LICENSE BLOCK *****

import sys, os, subprocess, struct, re

local_file_header = [
    ("signature", "uint32"),
    ("min_version", "uint16"),
    ("general_flag", "uint16"),
    ("compression", "uint16"),
    ("lastmod_time", "uint16"),
    ("lastmod_date", "uint16"),
    ("crc32", "uint32"),
    ("compressed_size", "uint32"),
    ("uncompressed_size", "uint32"),
    ("filename_size", "uint16"),
    ("extra_field_size", "uint16"),
    ("filename", "filename_size"),
    ("extra_field", "extra_field_size"),
    ("data", "compressed_size")
]

cdir_entry = [
    ("signature", "uint32"),
    ("creator_version", "uint16"),
    ("min_version", "uint16"),
    ("general_flag", "uint16"),
    ("compression", "uint16"),
    ("lastmod_time", "uint16"),
    ("lastmod_date", "uint16"),
    ("crc32", "uint32"),
    ("compressed_size", "uint32"),
    ("uncompressed_size", "uint32"),
    ("filename_size", "uint16"),
    ("extrafield_size", "uint16"),
    ("filecomment_size", "uint16"),
    ("disknum", "uint16"),
    ("internal_attr", "uint16"),
    ("external_attr", "uint32"),
    ("offset", "uint32"),
    ("filename", "filename_size"),
    ("extrafield", "extrafield_size"),
    ("filecomment", "filecomment_size"),
]

cdir_end = [
    ("signature", "uint32"),
    ("disk_num", "uint16"),
    ("cdir_disk", "uint16"),
    ("disk_entries", "uint16"),
    ("cdir_entries", "uint16"),
    ("cdir_size", "uint32"),
    ("cdir_offset", "uint32"),
    ("comment_size", "uint16"),
]

type_mapping = { "uint32":"I", "uint16":"H"}

def format_struct (format):
    string_fields = {}
    fmt = "<"
    for (name,value) in iter(format):
        try:
            fmt += type_mapping[value][0]
        except KeyError:
            string_fields[name] = value
    return (fmt, string_fields)

def size_of(format):
    return struct.calcsize(format_struct(format)[0])

class MyStruct:
    def __init__(self, format, string_fields):
        self.__dict__["struct_members"] = {}
        self.__dict__["format"] = format
        self.__dict__["string_fields"] = string_fields

    def addMember(self, name, value):
        self.__dict__["struct_members"][name] = value

    def __getattr__(self, item):
        try:
            return self.__dict__["struct_members"][item]
        except:
            pass
        print("no %s" %item)
        print(self.__dict__["struct_members"])
        raise AttributeError

    def __setattr__(self, item, value):
        if item in self.__dict__["struct_members"]:
            self.__dict__["struct_members"][item] = value
        else:
            raise AttributeError

    def pack(self):
        extra_data = b""
        values = []
        string_fields = self.__dict__["string_fields"]
        struct_members = self.__dict__["struct_members"]
        format = self.__dict__["format"]
        for (name,_) in format:
            if name in string_fields:
                if not isinstance(struct_members[name], bytes):
                    struct_members[name] = struct_members[name].encode('utf-8')
                extra_data = extra_data + struct_members[name]
            else:
                values.append(struct_members[name]);
        return struct.pack(format_struct(format)[0], *values) + extra_data
   
ENDSIG = 0x06054b50

def assert_true(cond, msg):
    if not cond:
        raise Exception(msg)
        exit(1)

class BinaryBlob:
    def __init__(self, f):
       self.data = open(f, "rb").read()
       self.offset = 0
       self.length = len(self.data)

    def readAt(self, pos, length):
        self.offset = pos + length
        return self.data[pos:self.offset]

    def read_struct (self, format, offset = None):
        if offset == None:
            offset = self.offset
        (fstr, string_fields) = format_struct(format)
        size = struct.calcsize(fstr)
        data = self.readAt(offset, size)
        ret = struct.unpack(fstr, data)
        retstruct = MyStruct(format, string_fields)
        i = 0
        for (name,_) in iter(format):
            member_desc = None
            if not name in string_fields:
                member_data = ret[i]
                i = i + 1
            else:
                # zip has data fields which are described by other struct fields, this does 
                # additional reads to fill em in
                member_desc = string_fields[name]
                member_data = self.readAt(self.offset, retstruct.__getattr__(member_desc))
            retstruct.addMember(name, member_data)
        # sanity check serialization code
        data = self.readAt(offset, self.offset - offset)
        out_data = retstruct.pack()
        assert_true(out_data == data, "Serialization fail %d !=%d"% (len(out_data), len(data)))
        return retstruct

def optimizejar(jar, outjar, inlog = None):
    if inlog is not None:
        inlog = open(inlog).read().rstrip()
        # in the case of an empty log still move the index forward
        if len(inlog) == 0:
            inlog = []
        else:
            inlog = inlog.split("\n")
    outlog = []
    jarblob = BinaryBlob(jar)
    dirend = jarblob.read_struct(cdir_end, jarblob.length - size_of(cdir_end))
    assert_true(dirend.signature == ENDSIG, "no signature in the end");
    cdir_offset = dirend.cdir_offset
    readahead = 0
    if inlog is None and cdir_offset == 4:
        readahead = struct.unpack("<I", jarblob.readAt(0, 4))[0]
        print("%s: startup data ends at byte %d" % (outjar, readahead));

    total_stripped = 0;
    jarblob.offset = cdir_offset
    central_directory = []
    for i in range(0, dirend.cdir_entries):
        entry = jarblob.read_struct(cdir_entry)
        if entry.filename[-1:] == "/":
            total_stripped += len(entry.pack())
        else:
            total_stripped += entry.extrafield_size
        central_directory.append(entry)
        
    reordered_count = 0
    if inlog is not None:
        dup_guard = set()
        for ordered_name in inlog:
            if ordered_name in dup_guard:
                continue
            else:
                dup_guard.add(ordered_name)
            found = False
            for i in range(reordered_count, len(central_directory)):
                if central_directory[i].filename == ordered_name:
                    # swap the cdir entries
                    tmp = central_directory[i]
                    central_directory[i] = central_directory[reordered_count]
                    central_directory[reordered_count] = tmp
                    reordered_count = reordered_count + 1
                    found = True
                    break
            if not found:
                print( "Can't find '%s' in %s" % (ordered_name, jar))

    outfd = open(outjar, "wb")
    out_offset = 0
    if inlog is not None:
        # have to put central directory at offset 4 cos 0 confuses some tools.
        # This also lets us specify how many entries should be preread
        dirend.cdir_offset = 4
        # make room for central dir + end of dir + 4 extra bytes at front
        out_offset = dirend.cdir_offset + dirend.cdir_size + size_of(cdir_end) - total_stripped
        outfd.seek(out_offset)

    cdir_data = b""
    written_count = 0
    crc_mapping = {}
    dups_found = 0
    dupe_bytes = 0
    # store number of bytes suggested for readahead
    for entry in central_directory:
        # read in the header twice..first for comparison, second time for convenience when writing out
        jarfile = jarblob.read_struct(local_file_header, entry.offset)
        assert_true(jarfile.filename == entry.filename, "Directory/Localheader mismatch")
        # drop directory entries
        if entry.filename[-1:] == "/":
            total_stripped += len(jarfile.pack())
            dirend.cdir_entries -= 1
            continue
        # drop extra field data
        else:
            total_stripped += jarfile.extra_field_size;
        entry.extrafield = jarfile.extra_field = ""
        entry.extrafield_size = jarfile.extra_field_size = 0
        # January 1st, 2010
        entry.lastmod_date = jarfile.lastmod_date = ((2010 - 1980) << 9) | (1 << 5) | 1
        entry.lastmod_time = jarfile.lastmod_time = 0
        data = jarfile.pack()
        outfd.write(data)
        old_entry_offset = entry.offset
        entry.offset = out_offset
        out_offset = out_offset + len(data)
        entry_data = entry.pack()
        cdir_data += entry_data
        expected_len = entry.filename_size + entry.extrafield_size + entry.filecomment_size
        assert_true(len(entry_data) != expected_len,
                    "%s entry size - expected:%d got:%d" % (entry.filename, len(entry_data), expected_len))
        written_count += 1

        if entry.crc32 in crc_mapping:
            dups_found += 1
            dupe_bytes += entry.compressed_size + len(data) + len(entry_data)
            print("%s\n\tis a duplicate of\n%s\n---"%(entry.filename, crc_mapping[entry.crc32]))
        else:
            crc_mapping[entry.crc32] = entry.filename;

        if inlog is not None:
            if written_count == reordered_count:
                readahead = out_offset
                print("%s: startup data ends at byte %d"%( outjar, readahead));
            elif written_count < reordered_count:
                pass
                #print("%s @ %d" % (entry.filename, out_offset))
        elif readahead >= old_entry_offset + len(data):
            outlog.append(entry.filename)
            reordered_count += 1

    if inlog is None:
        dirend.cdir_offset = out_offset

    if dups_found > 0:
        print("WARNING: Found %d duplicate files taking %d bytes"%(dups_found, dupe_bytes))

    dirend.cdir_size = len(cdir_data)
    dirend.disk_entries = dirend.cdir_entries
    dirend_data = dirend.pack()
    assert_true(size_of(cdir_end) == len(dirend_data), "Failed to serialize directory end correctly. Serialized size;%d, expected:%d"%(len(dirend_data), size_of(cdir_end)));

    outfd.seek(dirend.cdir_offset)
    outfd.write(cdir_data)
    outfd.write(dirend_data)

    # for ordered jars the central directory is written in the begining of the file, so a second central-directory
    # entry has to be written in the end of the file
    if inlog is not None:
        outfd.seek(0)
        outfd.write(struct.pack("<I", readahead));
        outfd.seek(out_offset)
        outfd.write(dirend_data)

    print("Stripped %d bytes" % total_stripped)
    print("%s %d/%d in %s" % (("Ordered" if inlog is not None else "Deoptimized"),
                              reordered_count, len(central_directory), outjar))
    outfd.close()
    return outlog
        
if len(sys.argv) != 5:
    print("Usage: --optimize|--deoptimize %s JAR_LOG_DIR IN_JAR_DIR OUT_JAR_DIR" % sys.argv[0])
    exit(1)

jar_regex = re.compile("\\.jar?$")

def optimize(JAR_LOG_DIR, IN_JAR_DIR, OUT_JAR_DIR):
    ls = os.listdir(IN_JAR_DIR)
    for jarfile in ls:
        if not re.search(jar_regex, jarfile):
            continue
        injarfile = os.path.join(IN_JAR_DIR, jarfile)
        outjarfile = os.path.join(OUT_JAR_DIR, jarfile) 
        logfile = os.path.join(JAR_LOG_DIR, jarfile + ".log")
        if not os.path.isfile(logfile):
            logfile = None
        optimizejar(injarfile, outjarfile, logfile)

def deoptimize(JAR_LOG_DIR, IN_JAR_DIR, OUT_JAR_DIR):
    if not os.path.exists(JAR_LOG_DIR):
        os.makedirs(JAR_LOG_DIR)

    ls = os.listdir(IN_JAR_DIR)
    for jarfile in ls:
        if not re.search(jar_regex, jarfile):
            continue
        injarfile = os.path.join(IN_JAR_DIR, jarfile)
        outjarfile = os.path.join(OUT_JAR_DIR, jarfile) 
        logfile = os.path.join(JAR_LOG_DIR, jarfile + ".log")
        log = str(optimizejar(injarfile, outjarfile, None))
        open(logfile, "wb").write("\n".join(log).encode('utf-8'))

def main():        
    MODE = sys.argv[1]
    JAR_LOG_DIR = sys.argv[2]
    IN_JAR_DIR = sys.argv[3]
    OUT_JAR_DIR = sys.argv[4]
    if MODE == "--optimize":
        optimize(JAR_LOG_DIR, IN_JAR_DIR, OUT_JAR_DIR)
    elif MODE == "--deoptimize":
        deoptimize(JAR_LOG_DIR, IN_JAR_DIR, OUT_JAR_DIR)
    else:
        print("Unknown mode %s" % MODE)
        exit(1)

if __name__ == '__main__':
    main()

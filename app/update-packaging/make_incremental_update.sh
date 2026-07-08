#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

#
# This tool generates incremental update packages for the update system.
# Author: Darin Fisher
#

# Added for Zotero
set -eo pipefail

. $(dirname "$0")/common.sh

# Process a single file task when invoked from run_parallel_tasks()
if [ "${1:-}" = "--run-task" ]; then
  process_update_task "$2"
  exit 0
fi

# -----------------------------------------------------------------------------

print_usage() {
  notice "Usage: $(basename $0) [OPTIONS] ARCHIVE FROMDIR TODIR"
  notice ""
  notice "The differences between FROMDIR and TODIR will be stored in ARCHIVE."
  notice ""
  notice "Options:"
  notice "  -h  show this help text"
  notice "  -f  clobber this file in the installation"
  notice "      Must be a path to a file to clobber in the partial update."
  notice "  -q  be less verbose"
  notice ""
}

check_for_forced_update() {
  force_list="$1"
  forced_file_chk="$2"

  local f

  if [ "$forced_file_chk" = "precomplete" ]; then
    ## "true" *giggle*
    return 0;
  fi

  if [ "$forced_file_chk" = "Contents/Resources/precomplete" ]; then
    ## "true" *giggle*
    return 0;
  fi

  if [ "$forced_file_chk" = "removed-files" ]; then
    ## "true" *giggle*
    return 0;
  fi

  if [ "$forced_file_chk" = "Contents/Resources/removed-files" ]; then
    ## "true" *giggle*
    return 0;
  fi

  # notarization ticket
  if [ "$forced_file_chk" = "Contents/CodeResources" ]; then
    ## "true" *giggle*
    return 0;
  fi

  if [ "${forced_file_chk##*.}" = "chk" ]; then
    ## "true" *giggle*
    return 0;
  fi

  for f in $force_list; do
    #echo comparing $forced_file_chk to $f
    if [ "$forced_file_chk" = "$f" ]; then
      ## "true" *giggle*
      return 0;
    fi
  done
  ## 'false'... because this is bash. Oh yay!
  return 1;
}

if [ $# = 0 ]; then
  print_usage
  exit 1
fi

requested_forced_updates='Contents/MacOS/firefox'

while getopts "hqf:" flag
do
   case "$flag" in
      h) print_usage; exit 0
      ;;
      q) QUIET=1
      ;;
      f) requested_forced_updates="$requested_forced_updates $OPTARG"
      ;;
      ?) print_usage; exit 1
      ;;
   esac
done

# -----------------------------------------------------------------------------

mar_command="$MAR -V ${MOZ_PRODUCT_VERSION:?} -H ${MAR_CHANNEL_ID:?}"

# Added for -e for Zotero
set +e
let arg_start=$OPTIND-1
shift $arg_start
set -e

archive="$1"
olddir="$2"
newdir="$3"
# Prevent the workdir from being inside the targetdir so it isn't included in
# the update mar.
if [ $(echo "$newdir" | grep -c '\/$') = 1 ]; then
  # Remove the /
  newdir=$(echo "$newdir" | sed -e 's:\/$::')
fi
workdir="$(mktemp -d)"
updatemanifestv3="$workdir/updatev3.manifest"
archivefiles="updatev3.manifest"

mkdir -p "$workdir"

# Generate a list of all files in the target directory.
pushd "$olddir"
if test $? -ne 0 ; then
  exit 1
fi

list_files oldfiles
list_dirs olddirs

popd

pushd "$newdir"
if test $? -ne 0 ; then
  exit 1
fi

if [ ! -f "precomplete" ]; then
  if [ ! -f "Contents/Resources/precomplete" ]; then
    notice "precomplete file is missing!"
    exit 1
  fi
fi

list_dirs newdirs
list_files newfiles

popd

# Add the type of update to the beginning of the update manifests.
notice ""
notice "Adding type instruction to update manifests"
> $updatemanifestv3
notice "       type partial"
echo "type \"partial\"" >> $updatemanifestv3

notice ""
notice "Adding file patch and add instructions to update manifests"

num_oldfiles=${#oldfiles[*]}
remove_array=
num_removes=0

# The main file loop is split into three passes so that the
# CPU-heavy work can run in parallel: classify each file into a task list, run
# the diffing/compression tasks in parallel via run_parallel_tasks() in
# common.sh, and then assemble the manifest and archive list serially in the
# original order based on the files the tasks left in the work directory.
#
# (This also drops the unused MBSDIFF_HOOK/funsize path from the upstream
# script -- the diff behavior itself is unchanged and now lives in
# process_update_task() in common.sh.)
tmpdir="$(mktemp -d)"
taskfile="$tmpdir/tasks"
TAB="$(printf '\t')"
> "$taskfile"

for ((i=0; $i<$num_oldfiles; i=$i+1)); do
  f="${oldfiles[$i]}"

  # If this file exists in the new directory as well, then check if it differs.
  if [ -f "$newdir/$f" ]; then
    if check_for_add_if_not_update "$f"; then
      echo "full$TAB$f" >> "$taskfile"
    elif check_for_forced_update "$requested_forced_updates" "$f"; then
      echo "full$TAB$f" >> "$taskfile"
    else
      echo "diff$TAB$f" >> "$taskfile"
    fi
  fi
done

# Newly added files -- in the new directory but not the old one. (This replaces
# the O(n^2) nested skip loop from the upstream script.)
printf '%s\n' "${oldfiles[@]}" | sort > "$tmpdir/oldlist"
printf '%s\n' "${newfiles[@]}" | sort > "$tmpdir/newlist"
comm -13 "$tmpdir/oldlist" "$tmpdir/newlist" | sed '/^$/d' | sort -r > "$tmpdir/newonly"

while IFS= read -r f; do
  echo "full$TAB$f" >> "$taskfile"
done < "$tmpdir/newonly"

export olddir newdir workdir MBSDIFF BCJ_OPTIONS QUIET
run_parallel_tasks "$taskfile" "$newdir" "$0"

# Assemble the manifest and archive list in the original order. A diffed file
# left $f.patch in the work directory if the patch was smaller, $f if the
# compressed file was smaller, and neither if the file was unchanged.
for ((i=0; $i<$num_oldfiles; i=$i+1)); do
  f="${oldfiles[$i]}"

  if [ -f "$newdir/$f" ]; then
    if check_for_add_if_not_update "$f"; then
      make_add_if_not_instruction "$f" "$updatemanifestv3"
      archivefiles="$archivefiles \"$f\""
    elif check_for_forced_update "$requested_forced_updates" "$f"; then
      make_add_instruction "$f" "$updatemanifestv3" 1
      archivefiles="$archivefiles \"$f\""
    elif [ -f "$workdir/$f.patch" ]; then
      make_patch_instruction "$f" "$updatemanifestv3"
      archivefiles="$archivefiles \"$f.patch\""
    elif [ -f "$workdir/$f" ]; then
      make_add_instruction "$f" "$updatemanifestv3"
      archivefiles="$archivefiles \"$f\""
    fi
  else
    # remove instructions are added after add / patch instructions for
    # consistency with make_incremental_updates.py
    remove_array[$num_removes]=$f
    # Changed by Zotero for -e
    #(( num_removes++ ))
    (( ++num_removes ))
  fi
done

# Newly added files
notice ""
notice "Adding file add instructions to update manifests"

while IFS= read -r f; do
  if check_for_add_if_not_update "$f"; then
    make_add_if_not_instruction "$f" "$updatemanifestv3"
  else
    make_add_instruction "$f" "$updatemanifestv3"
  fi

  archivefiles="$archivefiles \"$f\""
done < "$tmpdir/newonly"

rm -rf "$tmpdir"

notice ""
notice "Adding file remove instructions to update manifests"
for ((i=0; $i<$num_removes; i=$i+1)); do
  f="${remove_array[$i]}"
  verbose_notice "     remove \"$f\""
  echo "remove \"$f\"" >> $updatemanifestv3
done

# Add remove instructions for any dead files.
notice ""
notice "Adding file and directory remove instructions from file 'removed-files'"
append_remove_instructions "$newdir" "$updatemanifestv3"

notice ""
notice "Adding directory remove instructions for directories that no longer exist"
num_olddirs=${#olddirs[*]}

for ((i=0; $i<$num_olddirs; i=$i+1)); do
  f="${olddirs[$i]}"
  # If this dir doesn't exist in the new directory remove it.
  if [ ! -d "$newdir/$f" ]; then
    verbose_notice "      rmdir $f/"
    echo "rmdir \"$f/\"" >> $updatemanifestv3
  fi
done

$XZ $XZ_OPT --compress $BCJ_OPTIONS --lzma2 --format=xz --check=crc64 --force "$updatemanifestv3" && mv -f "$updatemanifestv3.xz" "$updatemanifestv3"

# Changed for Zotero -- -C is unreliable
pushd "$workdir" > /dev/null
mar_command="$mar_command -c output.mar"
eval "$mar_command $archivefiles"
popd > /dev/null
mv -f "$workdir/output.mar" "$archive"

# cleanup
rm -fr "$workdir"

notice ""
notice "Finished"
notice ""

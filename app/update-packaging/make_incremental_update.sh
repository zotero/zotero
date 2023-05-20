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

# channel-prefs.js removed for Zotero
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

for ((i=0; $i<$num_oldfiles; i=$i+1)); do
  f="${oldfiles[$i]}"

  # If this file exists in the new directory as well, then check if it differs.
  if [ -f "$newdir/$f" ]; then

    if check_for_add_if_not_update "$f"; then
      # The full workdir may not exist yet, so create it if necessary.
      mkdir -p `dirname "$workdir/$f"`
      $XZ $XZ_OPT --compress $BCJ_OPTIONS --lzma2 --format=xz --check=crc64 --force --stdout "$newdir/$f" > "$workdir/$f"
      copy_perm "$newdir/$f" "$workdir/$f"
      make_add_if_not_instruction "$f" "$updatemanifestv3"
      archivefiles="$archivefiles \"$f\""
      continue 1
    fi

    if check_for_forced_update "$requested_forced_updates" "$f"; then
      # The full workdir may not exist yet, so create it if necessary.
      mkdir -p `dirname "$workdir/$f"`
      $XZ $XZ_OPT --compress $BCJ_OPTIONS --lzma2 --format=xz --check=crc64 --force --stdout "$newdir/$f" > "$workdir/$f"
      copy_perm "$newdir/$f" "$workdir/$f"
      make_add_instruction "$f" "$updatemanifestv3" 1
      archivefiles="$archivefiles \"$f\""
      continue 1
    fi

    if ! diff "$olddir/$f" "$newdir/$f" > /dev/null; then
      # Compute both the compressed binary diff and the compressed file, and
      # compare the sizes.  Then choose the smaller of the two to package.
      dir=$(dirname "$workdir/$f")
      mkdir -p "$dir"
      verbose_notice "diffing \"$f\""
      # MBSDIFF_HOOK represents the communication interface with funsize and,
      # if enabled, caches the intermediate patches for future use and
      # compute avoidance
      #
      # An example of MBSDIFF_HOOK env variable could look like this:
      # export MBSDIFF_HOOK="myscript.sh -A https://funsize/api -c /home/user"
      # where myscript.sh has the following usage:
      # myscript.sh -A SERVER-URL [-c LOCAL-CACHE-DIR-PATH] [-g] [-u] \
      #   PATH-FROM-URL PATH-TO-URL PATH-PATCH SERVER-URL
      #
      # Note: patches are bzipped or xz stashed in funsize to gain more speed

      # if service is not enabled then default to old behavior
      # Disabled for Zotero
      #if [ -z "$MBSDIFF_HOOK" ]; then
      if true; then
        # mbsdiff doesn't like POSIX paths on Windows
        if [ $WIN_NATIVE -eq 1 ]; then
          oldfile_path=$(cygpath -m "$olddir/$f")
          newfile_path=$(cygpath -m "$newdir/$f")
          patch_path=$(cygpath -m "$workdir/$f.patch")
        else
          oldfile_path="$olddir/$f"
          newfile_path="$newdir/$f"
          patch_path="$workdir/$f.patch"
        fi
        $MBSDIFF "$oldfile_path" "$newfile_path" "$patch_path"
        $XZ $XZ_OPT --compress --lzma2 --format=xz --check=crc64 --force "$workdir/$f.patch"
      else
        # if service enabled then check patch existence for retrieval
        if $MBSDIFF_HOOK -g "$olddir/$f" "$newdir/$f" "$workdir/$f.patch.xz"; then
          verbose_notice "file \"$f\" found in funsize, diffing skipped"
        else
          # if not found already - compute it and cache it for future use
          $MBSDIFF "$olddir/$f" "$newdir/$f" "$workdir/$f.patch"
          $XZ $XZ_OPT --compress --lzma2 --format=xz --check=crc64 --force "$workdir/$f.patch"
          $MBSDIFF_HOOK -u "$olddir/$f" "$newdir/$f" "$workdir/$f.patch.xz"
        fi
      fi
      $XZ $XZ_OPT --compress $BCJ_OPTIONS --lzma2 --format=xz --check=crc64 --force --stdout "$newdir/$f" > "$workdir/$f"
      copy_perm "$newdir/$f" "$workdir/$f"
      patchfile="$workdir/$f.patch.xz"
      patchsize=$(get_file_size "$patchfile")
      fullsize=$(get_file_size "$workdir/$f")

      if [ $patchsize -lt $fullsize ]; then
        make_patch_instruction "$f" "$updatemanifestv3"
        mv -f "$patchfile" "$workdir/$f.patch"
        rm -f "$workdir/$f"
        archivefiles="$archivefiles \"$f.patch\""
      else
        make_add_instruction "$f" "$updatemanifestv3"
        rm -f "$patchfile"
        archivefiles="$archivefiles \"$f\""
      fi
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
num_newfiles=${#newfiles[*]}

for ((i=0; $i<$num_newfiles; i=$i+1)); do
  f="${newfiles[$i]}"

  # If we've already tested this file, then skip it
  for ((j=0; $j<$num_oldfiles; j=$j+1)); do
    if [ "$f" = "${oldfiles[j]}" ]; then
      continue 2
    fi
  done

  dir=$(dirname "$workdir/$f")
  mkdir -p "$dir"

  $XZ $XZ_OPT --compress $BCJ_OPTIONS --lzma2 --format=xz --check=crc64 --force --stdout "$newdir/$f" > "$workdir/$f"
  copy_perm "$newdir/$f" "$workdir/$f"

  if check_for_add_if_not_update "$f"; then
    make_add_if_not_instruction "$f" "$updatemanifestv3"
  else
    make_add_instruction "$f" "$updatemanifestv3"
  fi


  archivefiles="$archivefiles \"$f\""
done

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

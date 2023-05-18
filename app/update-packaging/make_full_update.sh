#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

#
# This tool generates full update packages for the update system.
# Author: Darin Fisher
#

# Added for Zotero
set -eo pipefail

. $(dirname "$0")/common.sh

# -----------------------------------------------------------------------------

print_usage() {
  notice "Usage: $(basename $0) [OPTIONS] ARCHIVE DIRECTORY"
}

if [ $# = 0 ]; then
  print_usage
  exit 1
fi

if [ $1 = -h ]; then
  print_usage
  notice ""
  notice "The contents of DIRECTORY will be stored in ARCHIVE."
  notice ""
  notice "Options:"
  notice "  -h  show this help text"
  notice "  -q  be less verbose"
  notice ""
  exit 1
fi

if [ $1 = -q ]; then
  QUIET=1
  export QUIET
  shift
fi

# -----------------------------------------------------------------------------

mar_command="$MAR -V ${MOZ_PRODUCT_VERSION:?} -H ${MAR_CHANNEL_ID:?}"

archive="$1"
targetdir="$2"
# Prevent the workdir from being inside the targetdir so it isn't included in
# the update mar.
if [ $(echo "$targetdir" | grep -c '\/$') = 1 ]; then
  # Remove the /
  targetdir=$(echo "$targetdir" | sed -e 's:\/$::')
fi
workdir="$targetdir.work"
updatemanifestv3="$workdir/updatev3.manifest"
targetfiles="updatev3.manifest"

mkdir -p "$workdir"

# Generate a list of all files in the target directory.
pushd "$targetdir"
if test $? -ne 0 ; then
  exit 1
fi

if [ ! -f "precomplete" ]; then
  if [ ! -f "Contents/Resources/precomplete" ]; then
    notice "precomplete file is missing!"
    exit 1
  fi
fi

list_files files

popd

# Add the type of update to the beginning of the update manifests.
> "$updatemanifestv3"
notice ""
notice "Adding type instruction to update manifests"
notice "       type complete"
echo "type \"complete\"" >> "$updatemanifestv3"

notice ""
notice "Adding file add instructions to update manifests"
num_files=${#files[*]}

for ((i=0; $i<$num_files; i=$i+1)); do
  f="${files[$i]}"

  if check_for_add_if_not_update "$f"; then
    make_add_if_not_instruction "$f" "$updatemanifestv3"
  else
    make_add_instruction "$f" "$updatemanifestv3"
  fi

  dir=$(dirname "$f")
  mkdir -p "$workdir/$dir"
  $XZ $XZ_OPT --compress $BCJ_OPTIONS --lzma2 --format=xz --check=crc64 --force --stdout "$targetdir/$f" > "$workdir/$f"
  copy_perm "$targetdir/$f" "$workdir/$f"

  targetfiles="$targetfiles \"$f\""
done

# Append remove instructions for any dead files.
notice ""
notice "Adding file and directory remove instructions from file 'removed-files'"
append_remove_instructions "$targetdir" "$updatemanifestv3"

$XZ $XZ_OPT --compress $BCJ_OPTIONS --lzma2 --format=xz --check=crc64 --force "$updatemanifestv3" && mv -f "$updatemanifestv3.xz" "$updatemanifestv3"

# Changed for Zotero -- -C is unreliable
pushd "$workdir" > /dev/null
mar_command="$mar_command -c output.mar"
eval "$mar_command $targetfiles"
popd > /dev/null
mv -f "$workdir/output.mar" "$archive"

# cleanup
rm -fr "$workdir"

notice ""
notice "Finished"
notice ""

#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

#
# Code shared by update packaging scripts.
# Author: Darin Fisher
#

# -----------------------------------------------------------------------------
# Preserve a value set by the parent so it survives in the child processes
# spawned by run_parallel_tasks()
QUIET=${QUIET:-0}

# By default just assume that these tools exist on our path
MAR=${MAR:-mar}
MBSDIFF=${MBSDIFF:-mbsdiff}
XZ=${XZ:-xz}
$XZ --version > /dev/null 2>&1
if [ $? -ne 0 ]; then
  # If $XZ is not set and not found on the path then this is probably
  # running on a windows buildbot. Some of the Windows build systems have
  # xz.exe in topsrcdir/xz/. Look in the places this would be in both a
  # mozilla-central and comm-central build.
  XZ="$(dirname "$(dirname "$(dirname "$0")")")/xz/xz.exe"
  $XZ --version > /dev/null 2>&1
  if [ $? -ne 0 ]; then
    XZ="$(dirname "$(dirname "$(dirname "$(dirname "$0")")")")/xz/xz.exe"
    $XZ --version > /dev/null 2>&1
    if [ $? -ne 0 ]; then
      echo "xz was not found on this system!"
      echo "exiting"
      exit 1
    fi
  fi
fi
# Ensure that we're always using the right compression settings.
# -T1 (single-threaded) is required: multi-threaded xz produces non-deterministic
# output, which would break the reproducibility of MARs.
export XZ_OPT="-T1 -7e"

# -----------------------------------------------------------------------------
# Helper routines

notice() {
  echo "$*" 1>&2
}

verbose_notice() {
  if [ $QUIET -eq 0 ]; then
    notice "$*"
  fi
}

get_file_size() {
  info=($(ls -ln "$1"))
  echo ${info[4]}
}

copy_perm() {
  reference="$1"
  target="$2"

  if [ -x "$reference" ]; then
    chmod 0755 "$target"
  else
    chmod 0644 "$target"
  fi
}

make_add_instruction() {
  f="$1"
  filev3="$2"

  # Used to log to the console
  if [ $4 ]; then
    forced=" (forced)"
  else
    forced=
  fi

  # Changed by Zotero for -e
  is_extension=$(echo "$f" | grep -c 'distribution/extensions/.*/') || true
  if [ $is_extension = "1" ]; then
    # Use the subdirectory of the extensions folder as the file to test
    # before performing this add instruction.
    testdir=$(echo "$f" | sed 's/\(.*distribution\/extensions\/[^\/]*\)\/.*/\1/')
    verbose_notice "     add-if \"$testdir\" \"$f\""
    echo "add-if \"$testdir\" \"$f\"" >> "$filev3"
  else
    verbose_notice "        add \"$f\"$forced"
    echo "add \"$f\"" >> "$filev3"
  fi
}

check_for_add_if_not_update() {
  add_if_not_file_chk="$1"

  if [[ "$(basename "$add_if_not_file_chk")" = "channel-prefs.js" || \
        "$add_if_not_file_chk" =~ (^|/)ChannelPrefs\.framework/ || \
        "$(basename "$add_if_not_file_chk")" = "update-settings.ini" || \
        "$add_if_not_file_chk" =~ (^|/)UpdateSettings\.framework/ ]]; then
    ## "true"
    return 0;
  fi
  ## "false"
  return 1;
}

make_add_if_not_instruction() {
  f="$1"
  filev3="$2"

  verbose_notice " add-if-not \"$f\" \"$f\""
  echo "add-if-not \"$f\" \"$f\"" >> "$filev3"
}

make_patch_instruction() {
  f="$1"
  filev3="$2"

  # Changed by Zotero for -e
  is_extension=$(echo "$f" | grep -c 'distribution/extensions/.*/') || true
  if [ $is_extension = "1" ]; then
    # Use the subdirectory of the extensions folder as the file to test
    # before performing this add instruction.
    testdir=$(echo "$f" | sed 's/\(.*distribution\/extensions\/[^\/]*\)\/.*/\1/')
    verbose_notice "   patch-if \"$testdir\" \"$f.patch\" \"$f\""
    echo "patch-if \"$testdir\" \"$f.patch\" \"$f\"" >> "$filev3"
  else
    verbose_notice "      patch \"$f.patch\" \"$f\""
    echo "patch \"$f.patch\" \"$f\"" >> "$filev3"
  fi
}

append_remove_instructions() {
  dir="$1"
  filev3="$2"

  if [ -f "$dir/removed-files" ]; then
    listfile="$dir/removed-files"
  elif [ -f "$dir/Contents/Resources/removed-files" ]; then
    listfile="$dir/Contents/Resources/removed-files"
  fi
  if [ -n "$listfile" ]; then
    # Changed by Zotero: Use subshell and disable filename globbing to prevent bash from expanding
    # entries in removed-files with paths from the root (e.g., 'xulrunner/*')
    (
    set -f
    # Map spaces to pipes so that we correctly handle filenames with spaces.
    files=($(cat "$listfile" | tr " " "|"  | sort -r))
    num_files=${#files[*]}
    for ((i=0; $i<$num_files; i=$i+1)); do
      # Map pipes back to whitespace and remove carriage returns
      f=$(echo ${files[$i]} | tr "|" " " | tr -d '\r')
      # Trim whitespace
      f=$(echo $f)
      # Exclude blank lines.
      if [ -n "$f" ]; then
        # Exclude comments
        if [ ! $(echo "$f" | grep -c '^#') = 1 ]; then
          if [ $(echo "$f" | grep -c '\/$') = 1 ]; then
            verbose_notice "      rmdir \"$f\""
            echo "rmdir \"$f\"" >> "$filev3"
          elif [ $(echo "$f" | grep -c '\/\*$') = 1 ]; then
            # Remove the *
            f=$(echo "$f" | sed -e 's:\*$::')
            verbose_notice "    rmrfdir \"$f\""
            echo "rmrfdir \"$f\"" >> "$filev3"
          else
            verbose_notice "     remove \"$f\""
            echo "remove \"$f\"" >> "$filev3"
          fi
        fi
      fi
    done
    )
  fi
}

# Return the number of parallel jobs to use for diffing/compression, from
# UPDATE_PACKAGING_JOBS or the number of cores
get_parallel_jobs() {
  if [ -n "${UPDATE_PACKAGING_JOBS:-}" ]; then
    echo "$UPDATE_PACKAGING_JOBS"
    return 0
  fi
  nproc 2>/dev/null && return 0
  sysctl -n hw.ncpu 2>/dev/null && return 0
  echo 1
}

# Run per-file tasks from a task file in parallel by re-invoking the calling
# script with --run-task for each line. Tasks are ordered largest-file-first so
# that long-running jobs (e.g., diffing xul) start as early as possible.
#
#   $1 - task file, with one "<type><TAB><relative path>" task per line
#   $2 - directory to measure file sizes against for job ordering
#   $3 - script to re-invoke (callers pass "$0" and handle --run-task before
#        option parsing by calling process_update_task)
#
# Callers must export the variables needed by process_update_task().
run_parallel_tasks() {
  local taskfile="$1"
  local basedir="$2"
  local script="$3"
  local jobs

  if [ ! -s "$taskfile" ]; then
    return 0
  fi

  # xargs requires a resolvable command path
  script="$(cd "$(dirname "$script")" && pwd)/$(basename "$script")"

  jobs=$(get_parallel_jobs)
  notice "Processing $(wc -l < "$taskfile" | tr -d ' ') files with $jobs parallel jobs"

  (cd "$basedir" && du -ak .) > "$taskfile.sizes"
  awk -F'\t' 'NR==FNR { sizes[substr($2, 3)] = $1; next } { print sizes[$2] "\t" $0 }' \
      "$taskfile.sizes" "$taskfile" \
    | sort -rn \
    | cut -f 2- \
    | tr '\n' '\000' \
    | xargs -0 -n 1 -P "$jobs" "$script" --run-task
}

# xz-compress $1 to $2
compress_full_file() {
  local src="$1"
  local dest="$2"

  $XZ $XZ_OPT --compress $BCJ_OPTIONS --lzma2 --format=xz --check=crc64 --force --stdout "$src" > "$dest"
}

# Process a single task line from run_parallel_tasks():
#
#   full - compress the new file into the work directory
#   diff - if the file changed, generate a binary diff and keep the smaller of
#          the compressed patch ($f.patch) and the compressed file ($f)
#
# Expects newdir and workdir in the environment, plus olddir for diff tasks.
# The results are assembled into the manifest serially by the caller based on
# which files exist in the work directory.
process_update_task() {
  local task="$1"
  local tab=$(printf '\t')
  local type="${task%%"$tab"*}"
  local f="${task#*"$tab"}"
  local oldfile_path newfile_path patch_path patchsize fullsize full_pid

  if [ "$type" = "diff" ]; then
    if diff "$olddir/$f" "$newdir/$f" > /dev/null; then
      # Unchanged
      return 0
    fi

    mkdir -p "$(dirname "$workdir/$f")"
    verbose_notice "diffing \"$f\""

    # Compress the full new file in the background while diffing, since both
    # are needed to decide which to package
    compress_full_file "$newdir/$f" "$workdir/$f" &
    full_pid=$!

    # mbsdiff doesn't like POSIX paths on Windows
    if [ ${WIN_NATIVE:-0} -eq 1 ]; then
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

    wait $full_pid
    copy_perm "$newdir/$f" "$workdir/$f"

    patchsize=$(get_file_size "$workdir/$f.patch.xz")
    fullsize=$(get_file_size "$workdir/$f")

    if [ $patchsize -lt $fullsize ]; then
      mv -f "$workdir/$f.patch.xz" "$workdir/$f.patch"
      rm -f "$workdir/$f"
    else
      rm -f "$workdir/$f.patch.xz"
    fi
  else
    mkdir -p "$(dirname "$workdir/$f")"
    compress_full_file "$newdir/$f" "$workdir/$f"
    copy_perm "$newdir/$f" "$workdir/$f"
  fi
}

# List all files in the current directory, stripping leading "./"
# Pass a variable name and it will be filled as an array.
list_files() {
  count=0
  temp_filelist=$(mktemp)
  find . -type f \
    ! -name "update.manifest" \
    ! -name "updatev2.manifest" \
    ! -name "updatev3.manifest" \
    | sed 's/\.\/\(.*\)/\1/' \
    | sort -r > "${temp_filelist}"
  while read file; do
    eval "${1}[$count]=\"$file\""
    # Changed for Zotero to avoid eval as 1
    #(( count++ ))
    (( ++count ))
  done < "${temp_filelist}"
  rm "${temp_filelist}"
}

# List all directories in the current directory, stripping leading "./"
list_dirs() {
  count=0
  temp_dirlist=$(mktemp)
  find . -type d \
    ! -name "." \
    ! -name ".." \
    | sed 's/\.\/\(.*\)/\1/' \
    | sort -r > "${temp_dirlist}"
  while read dir; do
    eval "${1}[$count]=\"$dir\""
    # Changed for Zotero
    #(( count++ ))
    (( ++count ))
  done < "${temp_dirlist}"
  rm "${temp_dirlist}"
}

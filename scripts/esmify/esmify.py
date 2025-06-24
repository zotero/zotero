#!/usr/bin/env python3

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

import json
import logging
import os
import pathlib
import re
import subprocess
import sys
import argparse


def path_sep_to_native(path_str):
    """Make separators in the path OS native."""
    return os.sep.join(path_str.split("/"))


def path_sep_from_native(path):
    """Make separators in the path OS native."""
    return "/".join(str(path).split(os.sep))


excluded_from_convert_prefix = list(
    map(
        path_sep_to_native,
        [
            # Testcases for actors.
            "toolkit/actors/TestProcessActorChild.jsm",
            "toolkit/actors/TestProcessActorParent.jsm",
            "toolkit/actors/TestWindowChild.jsm",
            "toolkit/actors/TestWindowParent.jsm",
            "js/xpconnect/tests/unit/",
            # Testcase for build system.
            "python/mozbuild/mozbuild/test/",
        ],
    )
)


def is_excluded_from_convert(path):
    """Returns true if the JSM file shouldn't be converted to ESM."""
    path_str = str(path)
    for prefix in excluded_from_convert_prefix:
        if path_str.startswith(prefix):
            return True

    return False


excluded_from_imports_prefix = list(
    map(
        path_sep_to_native,
        [
            # Vendored or auto-generated files.
            "browser/components/pocket/content/panels/js/vendor.bundle.js",
            "devtools/client/debugger/dist/parser-worker.js",
            "devtools/client/debugger/test/mochitest/examples/react/build/main.js",
            "devtools/client/debugger/test/mochitest/examples/sourcemapped/polyfill-bundle.js",
            "devtools/client/inspector/markup/test/shadowdom_open_debugger.min.js",
            "devtools/client/shared/source-map-loader/test/browser/fixtures/bundle.js",
            "layout/style/test/property_database.js",
            "services/fxaccounts/FxAccountsPairingChannel.js",
            "testing/talos/talos/tests/devtools/addon/content/pages/custom/debugger/static/js/main.js",  # noqa E501
            "testing/web-platform/",
            # Unrelated testcases that has edge case syntax.
            "browser/components/sessionstore/test/unit/data/",
            "devtools/client/debugger/src/workers/parser/tests/fixtures/",
            "devtools/client/debugger/test/mochitest/examples/sourcemapped/fixtures/",
            "devtools/client/webconsole/test/browser/test-syntaxerror-worklet.js",
            "devtools/server/tests/xpcshell/test_framebindings-03.js",
            "devtools/server/tests/xpcshell/test_framebindings-04.js",
            "devtools/shared/tests/xpcshell/test_eventemitter_basic.js",
            "devtools/shared/tests/xpcshell/test_eventemitter_static.js",
            "dom/base/crashtests/module-with-syntax-error.js",
            "dom/base/test/file_bug687859-16.js",
            "dom/base/test/file_bug687859-16.js",
            "dom/base/test/file_js_cache_syntax_error.js",
            "dom/base/test/jsmodules/module_badSyntax.js",
            "dom/canvas/test/reftest/webgl-utils.js",
            "dom/encoding/test/file_utf16_be_bom.js",
            "dom/encoding/test/file_utf16_le_bom.js",
            "dom/html/test/bug649134/file_bug649134-1.sjs",
            "dom/html/test/bug649134/file_bug649134-2.sjs",
            "dom/media/webrtc/tests/mochitests/identity/idp-bad.js",
            "dom/serviceworkers/test/file_js_cache_syntax_error.js",
            "dom/serviceworkers/test/parse_error_worker.js",
            "dom/workers/test/importScripts_worker_imported3.js",
            "dom/workers/test/invalid.js",
            "dom/workers/test/threadErrors_worker1.js",
            "dom/xhr/tests/browser_blobFromFile.js",
            "image/test/browser/browser_image.js",
            "js/xpconnect/tests/chrome/test_bug732665_meta.js",
            "js/xpconnect/tests/mochitest/class_static_worker.js",
            "js/xpconnect/tests/unit/bug451678_subscript.js",
            "js/xpconnect/tests/unit/error_other.sys.mjs",
            "js/xpconnect/tests/unit/es6module_parse_error.js",
            "js/xpconnect/tests/unit/recursive_importA.jsm",
            "js/xpconnect/tests/unit/recursive_importB.jsm",
            "js/xpconnect/tests/unit/syntax_error.jsm",
            "js/xpconnect/tests/unit/test_defineModuleGetter.js",
            "js/xpconnect/tests/unit/test_import.js",
            "js/xpconnect/tests/unit/test_import_shim.js",
            "js/xpconnect/tests/unit/test_recursive_import.js",
            "js/xpconnect/tests/unit/test_unload.js",
            "modules/libpref/test/unit/data/testParser.js",
            "python/mozbuild/mozbuild/test/",
            "remote/shared/messagehandler/test/browser/resources/modules/root/invalid.sys.mjs",
            "testing/talos/talos/startup_test/sessionrestore/profile-manywindows/sessionstore.js",
            "testing/talos/talos/startup_test/sessionrestore/profile/sessionstore.js",
            "toolkit/components/reader/Readerable.sys.mjs",
            "toolkit/components/workerloader/tests/moduleF-syntax-error.js",
            "tools/lint/test/",
            "tools/update-packaging/test/",
            # SpiderMonkey internals.
            "js/examples/",
            "js/src/",
            # Files has macro.
            "browser/app/profile/firefox.js",
            "browser/branding/official/pref/firefox-branding.js",
            "browser/components/enterprisepolicies/schemas/schema.sys.mjs",
            "browser/locales/en-US/firefox-l10n.js",
            "mobile/android/app/geckoview-prefs.js",
            "mobile/android/app/mobile.js",
            "mobile/android/locales/en-US/mobile-l10n.js",
            "modules/libpref/greprefs.js",
            "modules/libpref/init/all.js",
            "testing/condprofile/condprof/tests/profile/user.js",
            "testing/mozbase/mozprofile/tests/files/prefs_with_comments.js",
            "toolkit/modules/AppConstants.sys.mjs",
            "toolkit/mozapps/update/tests/data/xpcshellConstantsPP.js",
            # Uniffi templates
            "toolkit/components/uniffi-bindgen-gecko-js/src/templates/js/",
            "node_modules/",
            "resource/tinymce/",
            "resource/react",
        ],
    )
)

EXCLUSION_FILES = []


def load_exclusion_files():
    for path in EXCLUSION_FILES:
        with open(path, "r") as f:
            for line in f:
                p = path_sep_to_native(re.sub("\*$", "", line.strip()))
                excluded_from_imports_prefix.append(p)


def is_excluded_from_imports(path):
    """Returns true if the JS file content shouldn't be handled by
    jscodeshift.

    This filter is necessary because jscodeshift cannot handle some
    syntax edge cases and results in unexpected rewrite."""
    path_str = str(path)
    for prefix in excluded_from_imports_prefix:
        if path_str.startswith(prefix):
            return True

    return False


# Wrapper for hg/git operations
class VCSUtils:
    def run(self, cmd):
        # Do not pass check=True because the pattern can match no file.
        lines = subprocess.run(cmd, stdout=subprocess.PIPE).stdout.decode()
        return filter(lambda x: x != "", lines.split("\n"))


class GitUtils(VCSUtils):
    def is_available():
        return pathlib.Path(".git").exists()

    def rename(self, before, after):
        cmd = ["git", "mv", before, after]
        subprocess.run(cmd, check=True)

    def find_jsms(self, path):
        jsms = []

        cmd = ["git", "ls-files", f"{path}/*.jsm"]
        for line in self.run(cmd):
            jsm = pathlib.Path(line)
            if is_excluded_from_convert(jsm):
                continue
            jsms.append(jsm)

        handled = {}
        cmd = ["git", "grep", "EXPORTED_SYMBOLS = \[", f"{path}/*.js"]
        for line in self.run(cmd):
            m = re.search("^([^:]+):", line)
            if not m:
                continue
            filename = m.group(1)
            if filename in handled:
                continue
            handled[filename] = True
            jsm = pathlib.Path(filename)
            if is_excluded_from_convert(jsm):
                continue
            jsms.append(jsm)

        return jsms

    def find_all_jss(self, path):
        jss = []

        cmd = [
            "git",
            "ls-files",
            f"{path}/*.jsm",
            f"{path}/*.js",
            f"{path}/*.mjs",
            f"{path}/*.sjs",
        ]
        for line in self.run(cmd):
            js = pathlib.Path(line)
            if is_excluded_from_imports(js):
                continue
            jss.append(js)

        return jss


class Summary:
    def __init__(self):
        self.convert_errors = []
        self.import_errors = []
        self.rename_errors = []
        self.no_refs = []


def esmify(path=None, convert=False, imports=False, prefix=""):
    class CommandContext:
        def log(self, level, tag, _, message):
            print(f"{tag}: {message}")
    command_context = CommandContext()
    
    """
    This command does the following 2 steps:
      1. Convert the JSM file specified by `path` to ESM file, or the JSM files
         inside the directory specified by `path` to ESM files, and also
         fix references in build files and test definitions
      2. Convert import calls inside file(s) specified by `path` for ESM-ified
         files to use new APIs

    Example 1:
      # Convert all JSM files inside `browser/components/pagedata` directory,
      # and replace all references for ESM-ified files in the entire tree to use
      # new APIs

      $ ./mach esmify --convert browser/components/pagedata
      $ ./mach esmify --imports . --prefix=browser/components/pagedata

    Example 2:
      # Convert all JSM files inside `browser` directory, and replace all
      # references for the JSM files inside `browser` directory to use
      # new APIs

      $ ./mach esmify browser
    """

    def error(text):
        command_context.log(logging.ERROR, "esmify", {}, f"[ERROR] {text}")

    def warn(text):
        command_context.log(logging.WARN, "esmify", {}, f"[WARN] {text}")

    def info(text):
        command_context.log(logging.INFO, "esmify", {}, f"[INFO] {text}")

    # If no options is specified, perform both.
    if not convert and not imports:
        convert = True
        imports = True

    path = pathlib.Path(path[0])

    if not verify_path(command_context, path):
        return 1

    if GitUtils.is_available():
        vcs_utils = GitUtils()
    else:
        error(
            "This script needs to be run inside mozilla-central "
            "checkout of either mercurial or git."
        )
        return 1

    load_exclusion_files()

    info("Setting up jscodeshift...")
    setup_jscodeshift()

    is_single_file = path.is_file()

    summary = Summary()

    if convert:
        info("Searching files to convert to ESM...")
        if is_single_file:
            jsms = [path]
        else:
            jsms = vcs_utils.find_jsms(path)

        info(f"Found {len(jsms)} file(s) to convert to ESM.")

        info("Converting to ESM...")
        jsms = convert_module(jsms, summary)
        if jsms is None:
            error("Failed to rewrite exports.")
            return 1

        info("Renaming...")
        esms = rename_jsms(command_context, vcs_utils, jsms, summary)

    if imports:
        info("Searching files to rewrite imports...")

        if is_single_file:
            if convert:
                # Already converted above
                jss = esms
            else:
                jss = [path]
        else:
            jss = vcs_utils.find_all_jss(path)

        info(f"Checking {len(jss)} JS file(s). Rewriting any matching imports...")

        result = rewrite_imports(jss, prefix, summary)
        if result is None:
            return 1

        info(f"Rewritten {len(result)} file(s).")

    def print_files(f, errors):
        for [path, message] in errors:
            f(f"  * {path}")
            if message:
                f(f"    {message}")

    if len(summary.convert_errors):
        error("========")
        error("Following files are not converted into ESM due to error:")
        print_files(error, summary.convert_errors)

    if len(summary.import_errors):
        warn("========")
        warn("Following files are not rewritten to import ESMs due to error:")
        warn(
            "(NOTE: Errors related to 'private names' are mostly due to "
            " preprocessor macros in the file):"
        )
        print_files(warn, summary.import_errors)

    if len(summary.rename_errors):
        error("========")
        error("Following files are not renamed due to error:")
        print_files(error, summary.rename_errors)

    if len(summary.no_refs):
        warn("========")
        warn("Following files are not found in any build files.")
        warn("Please update references to those files manually:")
        print_files(warn, summary.rename_errors)

    return 0


def verify_path(command_context, path):
    """Check if the path passed to the command is valid relative path."""

    def error(text):
        command_context.log(logging.ERROR, "esmify", {}, f"[ERROR] {text}")

    if not path.exists():
        error(f"{path} does not exist.")
        return False

    if path.is_absolute():
        error("Path must be a relative path from mozilla-central checkout.")
        return False

    return True


def find_file(path, target):
    """Find `target` file in ancestor of path."""
    target_path = path.parent / target
    if not target_path.exists():
        if path.parent == path:
            return None

        return find_file(path.parent, target)

    return target_path


def try_rename_in(command_context, path, target, jsm_name, esm_name, jsm_path):
    """Replace the occurrences of `jsm_name` with `esm_name` in `target`
    file."""

    def info(text):
        command_context.log(logging.INFO, "esmify", {}, f"[INFO] {text}")

    if type(target) is str:
        # Target is specified by filename, that may exist somewhere in
        # the jsm's directory or ancestor directories.
        target_path = find_file(path, target)
        if not target_path:
            return False

        # JSM should be specified with relative path in the file.
        #
        # Single moz.build or jar.mn can contain multiple files with same name.
        # Search for relative path.
        jsm_relative_path = jsm_path.relative_to(target_path.parent)
        jsm_path_str = path_sep_from_native(str(jsm_relative_path))
    else:
        # Target is specified by full path.
        target_path = target

        # JSM should be specified with full path in the file.
        jsm_path_str = path_sep_from_native(str(jsm_path))

    jsm_path_re = re.compile(r"\b" + jsm_path_str.replace(".", r"\.") + r"\b")
    jsm_name_re = re.compile(r"\b" + jsm_name.replace(".", r"\.") + r"\b")

    modified = False
    content = ""
    with open(target_path, "r") as f:
        for line in f:
            if jsm_path_re.search(line):
                modified = True
                line = jsm_name_re.sub(esm_name, line)

            content += line

    if modified:
        info(f"  {str(target_path)}")
        info(f"    {jsm_name} => {esm_name}")
        with open(target_path, "w", newline="\n") as f:
            f.write(content)

    return True


def try_rename_uri_in(command_context, target, jsm_name, esm_name, jsm_uri, esm_uri):
    """Replace the occurrences of `jsm_uri` with `esm_uri` in `target` file."""

    def info(text):
        command_context.log(logging.INFO, "esmify", {}, f"[INFO] {text}")

    modified = False
    content = ""
    with open(target, "r") as f:
        for line in f:
            if jsm_uri in line:
                modified = True
                line = line.replace(jsm_uri, esm_uri)

            content += line

    if modified:
        info(f"  {str(target)}")
        info(f"    {jsm_name} => {esm_name}")
        with open(target, "w", newline="\n") as f:
            f.write(content)

    return True


def try_rename_components_conf(command_context, path, jsm_name, esm_name):
    """Replace the occurrences of `jsm_name` with `esm_name` in components.conf
    file."""

    def info(text):
        command_context.log(logging.INFO, "esmify", {}, f"[INFO] {text}")

    target_path = find_file(path, "components.conf")
    if not target_path:
        return False

    # Unlike try_rename_in, components.conf contains the URL instead of
    # relative path, and also there are no known files with same name.
    # Simply replace the filename.

    with open(target_path, "r") as f:
        content = f.read()

    prop_re = re.compile(
        "[\"']jsm[\"']:(.*)" + r"\b" + jsm_name.replace(".", r"\.") + r"\b"
    )

    if not prop_re.search(content):
        return False

    info(f"  {str(target_path)}")
    info(f"    {jsm_name} => {esm_name}")

    content = prop_re.sub(r"'esModule':\1" + esm_name, content)
    with open(target_path, "w", newline="\n") as f:
        f.write(content)

    return True


def esmify_name(name):
    return re.sub(r"\.(jsm|js|jsm\.js)$", ".sys.mjs", name)


def esmify_path(jsm_path):
    jsm_name = jsm_path.name
    esm_name = re.sub(r"\.(jsm|js|jsm\.js)$", ".sys.mjs", jsm_name)
    esm_path = jsm_path.parent / esm_name
    return esm_path


path_to_uri_map = None


def load_path_to_uri_map():
    global path_to_uri_map

    if path_to_uri_map:
        return

    if "ESMIFY_MAP_JSON" in os.environ:
        json_map = pathlib.Path(os.environ["ESMIFY_MAP_JSON"])
    else:
        json_map = pathlib.Path(__file__).parent / "map.json"

    with open(json_map, "r") as f:
        uri_to_path_map = json.loads(f.read())

    path_to_uri_map = dict()

    for uri, paths in uri_to_path_map.items():
        if type(paths) is str:
            paths = [paths]

        for path in paths:
            path_to_uri_map[path] = uri


def find_jsm_uri(jsm_path):
    load_path_to_uri_map()

    path = path_sep_from_native(jsm_path)

    if path in path_to_uri_map:
        return path_to_uri_map[path]

    return None


def rename_single_file(command_context, vcs_utils, jsm_path, summary):
    """Rename `jsm_path` to .sys.mjs, and fix references to the file in build
    and test definitions."""

    def info(text):
        command_context.log(logging.INFO, "esmify", {}, f"[INFO] {text}")

    esm_path = esmify_path(jsm_path)

    jsm_name = jsm_path.name
    esm_name = esm_path.name

    target_files = []

    info(f"{jsm_path} => {esm_path}")

    renamed = False
    for target in target_files:
        if try_rename_in(
            command_context, jsm_path, target, jsm_name, esm_name, jsm_path
        ):
            renamed = True

    if try_rename_components_conf(command_context, jsm_path, jsm_name, esm_name):
        renamed = True

    uri_target_files = [
        pathlib.Path(
            "browser", "base", "content", "test", "performance", "browser_startup.js"
        ),
        pathlib.Path(
            "browser",
            "base",
            "content",
            "test",
            "performance",
            "browser_startup_content.js",
        ),
        pathlib.Path(
            "browser",
            "base",
            "content",
            "test",
            "performance",
            "browser_startup_content_subframe.js",
        ),
        pathlib.Path(
            "toolkit",
            "components",
            "backgroundtasks",
            "tests",
            "browser",
            "browser_xpcom_graph_wait.js",
        ),
    ]

    jsm_uri = find_jsm_uri(jsm_path)
    if jsm_uri:
        esm_uri = re.sub(r"\.(jsm|js|jsm\.js)$", ".sys.mjs", jsm_uri)

        for target in uri_target_files:
            if try_rename_uri_in(
                command_context, target, jsm_uri, esm_uri, jsm_name, esm_name
            ):
                renamed = True

    if not renamed:
        summary.no_refs.append([jsm_path, None])

    if not esm_path.exists():
        vcs_utils.rename(jsm_path, esm_path)
    else:
        summary.rename_errors.append([jsm_path, f"{esm_path} already exists"])

    return esm_path


def rename_jsms(command_context, vcs_utils, jsms, summary):
    esms = []
    for jsm in jsms:
        esm = rename_single_file(command_context, vcs_utils, jsm, summary)
        esms.append(esm)

    return esms


npm_prefix = pathlib.Path("scripts") / "esmify"
path_from_npm_prefix = pathlib.Path("..") / ".."


def setup_jscodeshift():
    """Install jscodeshift."""
    cmd = [
        "npm",
        "install",
        "jscodeshift",
        "--save-dev",
        "--prefix",
        str(npm_prefix),
    ]
    subprocess.run(cmd, check=True)


def run_npm_command(args, env, stdin):
    cmd = [
        "npm",
        "run",
    ] + args
    p = subprocess.Popen(cmd, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    p.stdin.write(stdin)
    p.stdin.close()

    ok_files = []
    errors = []
    while True:
        line = p.stdout.readline()
        if not line:
            break
        line = line.rstrip().decode()

        if line.startswith(" NOC "):
            continue

        print(line)

        m = re.search(r"^ (OKK|ERR) ([^ ]+)(?: (.+))?", line)
        if not m:
            continue

        result = m.group(1)
        # NOTE: path is written from `tools/esmify`.
        path = pathlib.Path(m.group(2)).relative_to(path_from_npm_prefix)
        error = m.group(3)

        if result == "OKK":
            ok_files.append(path)

        if result == "ERR":
            errors.append([path, error])

    if p.wait() != 0:
        return [None, None]

    return ok_files, errors


def convert_module(jsms, summary):
    """Replace EXPORTED_SYMBOLS with export declarations, and replace
    ChromeUtils.importESModule with static import as much as possible,
    and return the list of successfully rewritten files."""

    if len(jsms) == 0:
        return []

    env = os.environ.copy()

    stdin = "\n".join(map(str, paths_from_npm_prefix(jsms))).encode()

    ok_files, errors = run_npm_command(
        [
            "convert_module",
            "--prefix",
            str(npm_prefix),
        ],
        env=env,
        stdin=stdin,
    )

    if ok_files is None and errors is None:
        return None

    summary.convert_errors.extend(errors)

    return ok_files


def rewrite_imports(jss, prefix, summary):
    """Replace import calls for JSM with import calls for ESM or static import
    for ESM."""

    if len(jss) == 0:
        return []

    env = os.environ.copy()
    env["ESMIFY_TARGET_PREFIX"] = prefix

    stdin = "\n".join(map(str, paths_from_npm_prefix(jss))).encode()

    ok_files, errors = run_npm_command(
        [
            "rewrite_imports",
            "--prefix",
            str(npm_prefix),
        ],
        env=env,
        stdin=stdin,
    )

    if ok_files is None and errors is None:
        return None

    summary.import_errors.extend(errors)

    return ok_files


def paths_from_npm_prefix(paths):
    """Convert relative path from mozilla-central to relative path from
    tools/esmify."""
    return list(map(lambda path: path_from_npm_prefix / path, paths))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "path",
        nargs=1,
        help="Path to the JSM file to ESMify, or the directory that contains "
             "JSM files and/or JS files that imports ESM-ified JSM.",
    )
    parser.add_argument(
        "--convert",
        action="store_true",
        help="Only perform the step 1 = convert part",
    )
    parser.add_argument(
        "--imports",
        action="store_true",
        help="Only perform the step 2 = import calls part",
    )
    parser.add_argument(
        "--prefix",
        default="",
        help="Restrict the target of import in the step 2 to ESM-ified JSM, by the "
             "prefix match for the JSM file's path.  e.g. 'browser/'.",
    )
    args = parser.parse_args()
    esmify(path=args.path, convert=args.convert, imports=args.imports, prefix=args.prefix)

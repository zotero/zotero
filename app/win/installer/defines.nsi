#filter substitution
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Win7: AppVendor, AppName, and AppVersion must match the application.ini values
# of Vendor, Name, and Version. These values are used in registering shortcuts
# with the taskbar. ExplicitAppUserModelID registration when the app launches is
# handled in widget/src/windows/WinTaskbar.cpp.

!define AppVendor             "Zotero"
!define AppName               "Zotero"
!define AppVersion            "{{VERSION}}"
!define AppUserModelID        "${AppVendor}.${AppName}.${AppVersion}"
!define GREVersion            2.0
!define AB_CD                 "en-US"

!define FileMainEXE           "zotero.exe"
!define WindowClass           "ZoteroMessageWindow"
!define AppRegName            "Zotero"

!define BrandShortName        "Zotero"
!define PreReleaseSuffix      ""
!define BrandFullName         "${BrandFullNameInternal}${PreReleaseSuffix}"

!define NO_UNINSTALL_SURVEY

# LSP_CATEGORIES is the permitted LSP categories for the application. Each LSP
# category value is ANDed together to set multiple permitted categories.
# See http://msdn.microsoft.com/en-us/library/ms742253%28VS.85%29.aspx
# The value below removes all LSP categories previously set.
!define LSP_CATEGORIES "0x00000000"

# NO_INSTDIR_FROM_REG is defined for pre-releases which have a PreReleaseSuffix
# (e.g. Alpha X, Beta X, etc.) to prevent finding a non-default installation
# directory in the registry and using that as the default. This prevents
# Beta releases built with official branding from finding an existing install
# of an official release and defaulting to its installation directory.
!if "@PRE_RELEASE_SUFFIX@" != ""
!define NO_INSTDIR_FROM_REG
!endif

# ARCH is used when it is necessary to differentiate the x64 registry keys from
# the x86 registry keys (e.g. the uninstall registry key).
!ifdef HAVE_64BIT_BUILD
  !ifdef _ARM64_
    !define ARCH "AArch64"
    !define MinSupportedVer "Microsoft Windows 10 for ARM"
  !else
    !define ARCH "x64"
    !define MinSupportedVer "64-bit Microsoft Windows 7"
  !endif
!else
  !define ARCH "x86"
  !define MinSupportedVer "Microsoft Windows 7"
!endif

# File details shared by both the installer and uninstaller
VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName"     "${BrandShortName}"
VIAddVersionKey "CompanyName"     "${CompanyName}"
VIAddVersionKey "LegalCopyright"  "${CompanyName}"
VIAddVersionKey "FileVersion"     "${AppVersion}"
VIAddVersionKey "ProductVersion"  "${AppVersion}"
# Comments is not used but left below commented out for future reference
# VIAddVersionKey "Comments"        "Comments"

# These are used for keeping track of user preferences. They are set to a
# default value in the installer's .OnInit callback, and then conditionally
# modified through the UI or an .ini file.

!define DESKTOP_SHORTCUT_DISABLED 0
!define DESKTOP_SHORTCUT_ENABLED  1
!define DESKTOP_SHORTCUT_DEFAULT  ${DESKTOP_SHORTCUT_ENABLED}

!define START_MENU_SHORTCUT_DISABLED 0
!define START_MENU_SHORTCUT_ENABLED  1
!define START_MENU_SHORTCUT_DEFAULT  ${START_MENU_SHORTCUT_ENABLED}

!define QUICKLAUNCH_SHORTCUT_DISABLED 0
!define QUICKLAUNCH_SHORTCUT_ENABLED  1
!define QUICKLAUNCH_SHORTCUT_DEFAULT  ${QUICKLAUNCH_SHORTCUT_ENABLED}

!define INSTALLTYPE_BASIC     1
!define INSTALLTYPE_CUSTOM    2
!define INSTALLTYPE_DEFAULT   ${INSTALLTYPE_BASIC}

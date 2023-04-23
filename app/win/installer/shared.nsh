# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

!macro PostUpdate
  ${CreateShortcutsLog}

  ; Remove registry entries for non-existent apps and for apps that point to our
  ; install location in the Software\Zotero key and uninstall registry entries
  ; that point to our install location for both HKCU and HKLM.
  SetShellVarContext current  ; Set SHCTX to the current user (e.g. HKCU)
  ${RegCleanMain} "Software\Zotero"
  ${RegCleanUninstall}
  ${UpdateProtocolHandlers}
  ; Win7 taskbar and start menu link maintenance
  Call FixShortcutAppModelIDs

  ClearErrors
  WriteRegStr HKLM "Software\Zotero" "${BrandShortName}InstallerTest" "Write Test"
  ${If} ${Errors}
    StrCpy $TmpVal "HKCU" ; used primarily for logging
  ${Else}
    SetShellVarContext all    ; Set SHCTX to all users (e.g. HKLM)
    DeleteRegValue HKLM "Software\Zotero" "${BrandShortName}InstallerTest"
    StrCpy $TmpVal "HKLM" ; used primarily for logging
    ${RegCleanMain} "Software\Zotero"
    ${RegCleanUninstall}
    ${UpdateProtocolHandlers}
    ${SetAppLSPCategories} ${LSP_CATEGORIES}

    ; Win7 taskbar and start menu link maintenance
    Call FixShortcutAppModelIDs

    ReadRegStr $0 HKLM "Software\zotero.org\Zotero" "CurrentVersion"
    ${If} "$0" != "${GREVersion}"
      WriteRegStr HKLM "Software\zotero.org\Zotero" "CurrentVersion" "${GREVersion}"
    ${EndIf}
  ${EndIf}

  ${SetAppKeys}
  ${FixClassKeys}
  ${SetUninstallKeys}
!macroend
!define PostUpdate "!insertmacro PostUpdate"

; Adds zotero:// protocol handler and makes Zotero open exported bib files
!macro SetHandlers
  Push "$INSTDIR\${FileMainEXE}"
  Call GetLongPath
  Pop $8
  
  ${AddHandlerValues} "Software\Classes\zotero" "$\"$8$\" -url $\"%1$\"" \
      "$8,1" "Zotero Protocol" "true" ""
  
  ; Add handlers for reference formats
  ${AddHandlerValues} "Software\Classes\ZoteroRIS" "$\"$8$\" -file $\"%1$\"" \
      "$8,1" "Research Information Systems Document" "" ""
  
  ${AddHandlerValues} "Software\Classes\ZoteroISI" "$\"$8$\" -file $\"%1$\"" \
      "$8,1" "ISI Common Export Format Document" "" ""
  
  ${AddHandlerValues} "Software\Classes\ZoteroMODS" "$\"$8$\" -file $\"%1$\"" \
      "$8,1" "Metadata Object Description Schema Document" "" ""
  
  ${AddHandlerValues} "Software\Classes\ZoteroRDF" "$\"$8$\" -file $\"%1$\"" \
      "$8,1" "Resource Description Framework Document" "" ""
  
  ${AddHandlerValues} "Software\Classes\ZoteroBibTeX" "$\"$8$\" -file $\"%1$\"" \
      "$8,1" "BibTeX Document" "" ""
  
  ${AddHandlerValues} "Software\Classes\ZoteroMARC" "$\"$8$\" -file $\"%1$\"" \
      "$8,1" "MARC Document" "" ""
  
  ${AddHandlerValues} "Software\Classes\ZoteroCSL" "$\"$8$\" -file $\"%1$\"" \
      "$8,1" "CSL Citation Style" "" ""
  
  ; Associate file handlers
  ReadRegStr $6 SHCTX "Software\Classes\.ris" ""
  ${If} "$6" != "ZoteroRIS"
    WriteRegStr SHCTX "Software\Classes\.ris"   "" "ZoteroRIS"
    WriteRegStr SHCTX "Software\Classes\.ris"   "Content Type" "application/x-research-info-systems"
  ${EndIf}
  
  ReadRegStr $6 SHCTX "Software\Classes\.mods" ""
  ${If} "$6" != "ZoteroMODS"
    WriteRegStr SHCTX "Software\Classes\.mods"  "" "ZoteroMODS"
    WriteRegStr SHCTX "Software\Classes\.mods"   "Content Type" "application/mods+xml"
  ${EndIf}
  
  ReadRegStr $6 SHCTX "Software\Classes\.isi" ""
  ${If} "$6" != "ZoteroMODS"
    WriteRegStr SHCTX "Software\Classes\.isi"  "" "ZoteroISI"
    WriteRegStr SHCTX "Software\Classes\.isi"   "Content Type" "application/x-inst-for-Scientific-info"
  ${EndIf}
  
  ReadRegStr $6 SHCTX "Software\Classes\.rdf" ""
  ${If} "$6" != "ZoteroRDF"
    WriteRegStr SHCTX "Software\Classes\.rdf"  "" "ZoteroRDF"
    WriteRegStr SHCTX "Software\Classes\.rdf"   "Content Type" "application/rdf+xml"
  ${EndIf}
  
  ReadRegStr $6 SHCTX "Software\Classes\.bib" ""
  ${If} "$6" != "ZoteroBibTeX"
    WriteRegStr SHCTX "Software\Classes\.bib"  "" "ZoteroBibTeX"
    WriteRegStr SHCTX "Software\Classes\.bib"   "Content Type" "application/x-bibtex"
  ${EndIf}
  
  ReadRegStr $6 SHCTX "Software\Classes\.bibtex" ""
  ${If} "$6" != "ZoteroMARC"
    WriteRegStr SHCTX "Software\Classes\.bibtex"  "" "ZoteroBibTeX"
    WriteRegStr SHCTX "Software\Classes\.bibtex"   "Content Type" "application/x-bibtex"
  ${EndIf}
  
  ReadRegStr $6 SHCTX "Software\Classes\.marc" ""
  ${If} "$6" != "ZoteroMARC"
    WriteRegStr SHCTX "Software\Classes\.marc"  "" "ZoteroMARC"
    WriteRegStr SHCTX "Software\Classes\.marc"   "Content Type" "application/marc"
  ${EndIf}
  
  ReadRegStr $6 SHCTX "Software\Classes\.csl" ""
  ${If} "$6" != "ZoteroCSL"
    WriteRegStr SHCTX "Software\Classes\.csl"  "" "ZoteroCSL"
    WriteRegStr SHCTX "Software\Classes\.csl"   "Content Type" "application/vnd.citationstyles.style+xml"
  ${EndIf}
!macroend
!define SetHandlers "!insertmacro SetHandlers"

; Add Software\Zotero\ registry entries (uses SHCTX).
!macro SetAppKeys
  Push $INSTDIR
  Call GetLongPath
  Pop $8
  StrCpy $0 "Software\Zotero\${BrandFullNameInternal}\${AppVersion} (${AB_CD})\Main"
  ${WriteRegStr2} $TmpVal "$0" "Install Directory" "$8" 0
  ${WriteRegStr2} $TmpVal "$0" "PathToExe" "$8\${FileMainEXE}" 0

  StrCpy $0 "Software\Zotero\${BrandFullNameInternal}\${AppVersion} (${AB_CD})\Uninstall"
  ${WriteRegStr2} $TmpVal "$0" "Description" "${BrandFullNameInternal} ${AppVersion} (${ARCH} ${AB_CD})" 0

  StrCpy $0 "Software\Zotero\${BrandFullNameInternal}\${AppVersion} (${AB_CD})"
  ${WriteRegStr2} $TmpVal  "$0" "" "${AppVersion} (${AB_CD})" 0

  StrCpy $0 "Software\Zotero\${BrandFullNameInternal} ${AppVersion}\bin"
  ${WriteRegStr2} $TmpVal "$0" "PathToExe" "$8\${FileMainEXE}" 0

  StrCpy $0 "Software\Zotero\${BrandFullNameInternal} ${AppVersion}\extensions"
  ${WriteRegStr2} $TmpVal "$0" "Components" "$8\components" 0
  ${WriteRegStr2} $TmpVal "$0" "Plugins" "$8\plugins" 0

  StrCpy $0 "Software\Zotero\${BrandFullNameInternal} ${AppVersion}"
  ${WriteRegStr2} $TmpVal "$0" "GeckoVer" "${GREVersion}" 0

  StrCpy $0 "Software\Zotero\${BrandFullNameInternal}"
  ${WriteRegStr2} $TmpVal "$0" "" "${GREVersion}" 0
  ${WriteRegStr2} $TmpVal "$0" "CurrentVersion" "${AppVersion} (${AB_CD})" 0
!macroend
!define SetAppKeys "!insertmacro SetAppKeys"

; Add uninstall registry entries. This macro tests for write access to determine
; if the uninstall keys should be added to HKLM or HKCU.
!macro SetUninstallKeys
  StrCpy $0 "Software\Microsoft\Windows\CurrentVersion\Uninstall\${BrandFullNameInternal} ${AppVersion} (${ARCH} ${AB_CD})"

  StrCpy $2 ""
  ClearErrors
  WriteRegStr HKLM "$0" "${BrandShortName}InstallerTest" "Write Test"
  ${If} ${Errors}
    ; If the uninstall keys already exist in HKLM don't create them in HKCU
    ClearErrors
    ReadRegStr $2 "HKLM" $0 "DisplayName"
    ${If} $2 == ""
      ; Otherwise we don't have any keys for this product in HKLM so proceeed
      ; to create them in HKCU.  Better handling for this will be done in:
      ; Bug 711044 - Better handling for 2 uninstall icons
      StrCpy $1 "HKCU"
      SetShellVarContext current  ; Set SHCTX to the current user (e.g. HKCU)
    ${EndIf}
    ClearErrors
  ${Else}
    StrCpy $1 "HKLM"
    SetShellVarContext all     ; Set SHCTX to all users (e.g. HKLM)
    DeleteRegValue HKLM "$0" "${BrandShortName}InstallerTest"
  ${EndIf}

  ${If} $2 == ""
    Push $INSTDIR
    Call GetLongPath
    Pop $8

    ; Write the uninstall registry keys
    ${WriteRegStr2} $1 "$0" "Comments" "${BrandFullNameInternal} ${AppVersion} (${ARCH} ${AB_CD})" 0
    ${WriteRegStr2} $1 "$0" "DisplayIcon" "$8\${FileMainEXE},0" 0
    ${WriteRegStr2} $1 "$0" "DisplayName" "${BrandFullNameInternal}" 0
    ${WriteRegStr2} $1 "$0" "DisplayVersion" "${AppVersion}" 0
    ${WriteRegStr2} $1 "$0" "InstallLocation" "$8" 0
    ${WriteRegStr2} $1 "$0" "Publisher" "Corporation for Digital Scholarship" 0
    ${WriteRegStr2} $1 "$0" "UninstallString" "$8\uninstall\helper.exe" 0
    ${WriteRegStr2} $1 "$0" "URLInfoAbout" "${URLInfoAbout}" 0
    ${WriteRegStr2} $1 "$0" "URLUpdateInfo" "${URLUpdateInfo}" 0
    ${WriteRegDWORD2} $1 "$0" "NoModify" 1 0
    ${WriteRegDWORD2} $1 "$0" "NoRepair" 1 0

    ${GetSize} "$8" "/S=0K" $R2 $R3 $R4
    ${WriteRegDWORD2} $1 "$0" "EstimatedSize" $R2 0

    ${If} "$TmpVal" == "HKLM"
      SetShellVarContext all     ; Set SHCTX to all users (e.g. HKLM)
    ${Else}
      SetShellVarContext current  ; Set SHCTX to the current user (e.g. HKCU)
    ${EndIf}
  ${EndIf}
!macroend
!define SetUninstallKeys "!insertmacro SetUninstallKeys"

; Add app specific handler registry entries under Software\Classes if they
; don't exist (does not use SHCTX).
!macro FixClassKeys
  StrCpy $1 "SOFTWARE\Classes"

  ; File handler keys and name value pairs that may need to be created during
  ; install or upgrade.
  ReadRegStr $0 HKCR ".shtml" "Content Type"
  ${If} "$0" == ""
    StrCpy $0 "$1\.shtml"
    ${WriteRegStr2} $TmpVal "$1\.shtml" "" "shtmlfile" 0
    ${WriteRegStr2} $TmpVal "$1\.shtml" "Content Type" "text/html" 0
    ${WriteRegStr2} $TmpVal "$1\.shtml" "PerceivedType" "text" 0
  ${EndIf}

  ReadRegStr $0 HKCR ".xht" "Content Type"
  ${If} "$0" == ""
    ${WriteRegStr2} $TmpVal "$1\.xht" "" "xhtfile" 0
    ${WriteRegStr2} $TmpVal "$1\.xht" "Content Type" "application/xhtml+xml" 0
  ${EndIf}

  ReadRegStr $0 HKCR ".xhtml" "Content Type"
  ${If} "$0" == ""
    ${WriteRegStr2} $TmpVal "$1\.xhtml" "" "xhtmlfile" 0
    ${WriteRegStr2} $TmpVal "$1\.xhtml" "Content Type" "application/xhtml+xml" 0
  ${EndIf}
!macroend
!define FixClassKeys "!insertmacro FixClassKeys"

; Updates protocol handlers if their registry open command value is for this
; install location (uses SHCTX).
!macro UpdateProtocolHandlers
  ; Store the command to open the app with an url in a register for easy access.
  Push "$INSTDIR\${FileMainEXE}"
  Call GetLongPath
  Pop $8

  ; Only set the file and protocol handlers if the existing one under HKCR is
  ; for this install location.

  ${IsHandlerForInstallDir} "zotero" $R9
  ${If} "$R9" == "true"
     ${AddHandlerValues} "SOFTWARE\Classes\zotero" "$\"$8$\" -url $\"%1$\"" \
	     "$8,1" "Zotero" "true" ""
  ${EndIf}
!macroend
!define UpdateProtocolHandlers "!insertmacro UpdateProtocolHandlers"

; Removes the application's start menu directory along with its shortcuts if
; they exist and if they exist creates a start menu shortcut in the root of the
; start menu directory (bug 598779). If the application's start menu directory
; is not empty after removing the shortucts the directory will not be removed
; since these additional items were not created by the installer (uses SHCTX).
!macro RemoveStartMenuDir
  ${GetShortcutsLogPath} $0
  ${If} ${FileExists} "$0"
    ; Delete Start Menu Programs shortcuts, directory if it is empty, and
    ; parent directories if they are empty up to but not including the start
    ; menu directory.
    Push $SMPROGRAMS
    Call GetLongPath
    Pop $1
    ClearErrors
    ReadINIStr $2 "$0" "SMPROGRAMS" "RelativePathToDir"
    ${Unless} ${Errors}
      Push "$1\$2"
      Call GetLongPath
      Pop $2
      ${If} "$2" != ""
        ; Delete shortucts in the Start Menu Programs directory.
        StrCpy $3 0
        ${Do}
          ClearErrors
          ReadINIStr $4 "$0" "SMPROGRAMS" "Shortcut$3"
          ; Stop if there are no more entries
          ${If} ${Errors}
            ${ExitDo}
          ${EndIf}
          ${If} ${FileExists} "$2\$4"
            ShellLink::GetShortCutTarget "$2\$4"
            Pop $5
            ${If} "$INSTDIR\${FileMainEXE}" == "$5"
              Delete "$2\$4"
            ${EndIf}
          ${EndIf}
          IntOp $3 $3 + 1 ; Increment the counter
        ${Loop}
        ; Delete Start Menu Programs directory and parent directories
        ${Do}
          ; Stop if the current directory is the start menu directory
          ${If} "$1" == "$2"
            ${ExitDo}
          ${EndIf}
          ClearErrors
          RmDir "$2"
          ; Stop if removing the directory failed
          ${If} ${Errors}
            ${ExitDo}
          ${EndIf}
          ${GetParent} "$2" $2
        ${Loop}
      ${EndIf}
      DeleteINISec "$0" "SMPROGRAMS"
    ${EndUnless}
  ${EndIf}
!macroend
!define RemoveStartMenuDir "!insertmacro RemoveStartMenuDir"

; Creates the shortcuts log ini file with the appropriate entries if it doesn't
; already exist.
!macro CreateShortcutsLog
  ${GetShortcutsLogPath} $0
  ${Unless} ${FileExists} "$0"
    ${LogStartMenuShortcut} "${BrandFullName}.lnk"
    ${LogQuickLaunchShortcut} "${BrandFullName}.lnk"
    ${LogDesktopShortcut} "${BrandFullName}.lnk"
  ${EndUnless}
!macroend
!define CreateShortcutsLog "!insertmacro CreateShortcutsLog"

; The files to check if they are in use during (un)install so the restart is
; required message is displayed. All files must be located in the $INSTDIR
; directory.
!macro PushFilesToCheck
  ; The first string to be pushed onto the stack MUST be "end" to indicate
  ; that there are no more files to check in $INSTDIR and the last string
  ; should be ${FileMainEXE} so if it is in use the CheckForFilesInUse macro
  ; returns after the first check.
  Push "end"
  Push "AccessibleMarshal.dll"
  Push "freebl3.dll"
  Push "nssckbi.dll"
  Push "nspr4.dll"
  Push "nssdbm3.dll"
  Push "mozsqlite3.dll"
  Push "xpcom.dll"
  Push "crashreporter.exe"
  Push "updater.exe"
  Push "${FileMainEXE}"
!macroend
!define PushFilesToCheck "!insertmacro PushFilesToCheck"

; Helper for updating the shortcut application model IDs.
Function FixShortcutAppModelIDs
  ${UpdateShortcutAppModelIDs} "$INSTDIR\${FileMainEXE}" "${AppUserModelID}" $0
FunctionEnd

; The !ifdef NO_LOG prevents warnings when compiling the installer.nsi due to
; this function only being used by the uninstaller.nsi.
!ifdef NO_LOG

!endif

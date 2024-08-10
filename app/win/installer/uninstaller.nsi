# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Required Plugins:
# AppAssocReg http://nsis.sourceforge.net/Application_Association_Registration_plug-in
# ShellLink   http://nsis.sourceforge.net/ShellLink_plug-in
# UAC         http://nsis.sourceforge.net/UAC_plug-in

; Set verbosity to 2 to lessen the noise in the build logs
!verbose 2

; 7-Zip provides better compression than the lzma from NSIS so we add the files
; uncompressed and use 7-Zip to create a SFX archive of it
SetDatablockOptimize on
SetCompress off
CRCCheck on

RequestExecutionLevel user

!addplugindir ./

; On Vista and above attempt to elevate Standard Users in addition to users that
; are a member of the Administrators group.
!define NONADMIN_ELEVATE

; prevents compiling of the reg write logging.
!define NO_LOG

; Other included files may depend upon these includes!
; The following includes are provided by NSIS.
!include FileFunc.nsh
!include LogicLib.nsh
!include MUI.nsh
!include WinMessages.nsh
!include WinVer.nsh
!include WordFunc.nsh

!insertmacro GetSize
!insertmacro StrFilter
!insertmacro WordReplace

!insertmacro un.GetParent

; The following includes are custom.
!include branding.nsi
!include defines.nsi
!include common.nsh
!include locales.nsi

; This is named BrandShortName helper because we use this for software update
; post update cleanup.
VIAddVersionKey "FileDescription" "${BrandShortName} Helper"
VIAddVersionKey "OriginalFilename" "helper.exe"

!insertmacro AddHandlerValues
!insertmacro ElevateUAC
!insertmacro GetOptions
!insertmacro GetParameters
!insertmacro GetPathFromString
!insertmacro IsHandlerForInstallDir
!insertmacro LogDesktopShortcut
!insertmacro LogQuickLaunchShortcut
!insertmacro LogStartMenuShortcut
!insertmacro RegCleanMain
!insertmacro RegCleanUninstall
!insertmacro SetAppLSPCategories
!insertmacro SetBrandNameVars
!insertmacro UpdateShortcutAppModelIDs
!insertmacro UpdateUninstallLog
!insertmacro WriteRegDWORD2
!insertmacro WriteRegStr2

!insertmacro un.ChangeMUIHeaderImage
!insertmacro un.CheckForFilesInUse
!insertmacro un.CleanUpdatesDir
!insertmacro un.DeleteShortcuts
!insertmacro un.ElevateUAC
!insertmacro un.GetSecondInstallPath
!insertmacro un.ManualCloseAppPrompt
!insertmacro un.ParseUninstallLog
!insertmacro un.RegCleanAppHandler
!insertmacro un.RegCleanFileHandler
!insertmacro un.RegCleanMain
!insertmacro un.RegCleanProtocolHandler
!insertmacro un.RegCleanUninstall
!insertmacro un.SetAppLSPCategories
!insertmacro un.SetBrandNameVars

!include shared.nsh

; Helper macros for ui callbacks. Insert these after shared.nsh
!insertmacro OnEndCommon

!insertmacro un.OnEndCommon

Name "${BrandFullName}"
OutFile "helper.exe"
!ifdef HAVE_64BIT_BUILD
  InstallDir "$PROGRAMFILES64\${BrandFullName}\"
!else
  InstallDir "$PROGRAMFILES32\${BrandFullName}\"
!endif
ShowUnInstDetails nevershow

################################################################################
# Modern User Interface - MUI

!define MUI_ABORTWARNING
!define MUI_ICON setup.ico
!define MUI_UNICON setup.ico
!define MUI_WELCOMEPAGE_TITLE_3LINES
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
#TODO !define MUI_UNWELCOMEFINISHPAGE_BITMAP wizWatermark.bmp

; Use a right to left header image when the language is right to left
#TODO !ifdef ${AB_CD}_rtl
#TODO !define MUI_HEADERIMAGE_BITMAP_RTL wizHeaderRTL.bmp
#TODO !else
#TODO !define MUI_HEADERIMAGE_BITMAP wizHeader.bmp
#TODO !endif

/**
 * Uninstall Pages
 */
; Welcome Page
!define MUI_PAGE_CUSTOMFUNCTION_PRE un.preWelcome
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE un.leaveWelcome
!insertmacro MUI_UNPAGE_WELCOME

; Custom Uninstall Confirm Page
UninstPage custom un.preConfirm un.leaveConfirm

; Remove Files Page
!insertmacro MUI_UNPAGE_INSTFILES

; Finish Page

; Don't setup the survey controls, functions, etc. when the application has
; defined NO_UNINSTALL_SURVEY
!ifndef NO_UNINSTALL_SURVEY
!define MUI_PAGE_CUSTOMFUNCTION_PRE un.preFinish
!define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT $(SURVEY_TEXT)
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION un.Survey
!endif

!insertmacro MUI_UNPAGE_FINISH

; Use the default dialog for IDD_VERIFY for a simple Banner
ChangeUI IDD_VERIFY "${NSISDIR}\Contrib\UIs\default.exe"

################################################################################
# Install Sections
; Empty section required for the installer to compile as an uninstaller
Section ""
SectionEnd

################################################################################
# Uninstall Sections

Section "Uninstall"
  SetDetailsPrint textonly
  DetailPrint $(STATUS_UNINSTALL_MAIN)
  SetDetailsPrint none

  ; Handle a few uninstall tasks for the current user even if this ends up being
  ; a system-wide uninstall.
  ${MUI_INSTALLOPTIONS_READ} $0 "unconfirm.ini" "Field 3" "State"
  ${If} "$0" == "1"
    SetShellVarContext current
    Push "Zotero\Zotero"
    Call un.DeleteRelativeProfiles
    RmDir "$APPDATA\Zotero"
  ${EndIf}

  ; Check whether Zotero was installed under HKLM. If it was we will need to elevate.
  SetShellVarContext all
  Push "0"
  Push $INSTDIR
  Call un.IterateUninstallKeys
  ; The error flag means no key was found. In that case set to user uninstall.
  ; When a key is found in HKLM leave shell context to all and trigger
  ; elevation prompt.
  IfErrors 0 elevate
  SetShellVarContext current
  Goto elevation_complete
  elevate:
  ${un.ElevateUAC}
  elevation_complete:
  Pop $Trash
  Pop $Trash

  ; Delete the app exe to prevent launching the app while we are uninstalling.
  ClearErrors
  ${DeleteFile} "$INSTDIR\${FileMainEXE}"
  ${If} ${Errors}
    ; If the user closed the application it can take several seconds for it to
    ; shut down completely. If the application is being used by another user we
    ; can still delete the files when the system is restarted.
    Sleep 5000
    ${DeleteFile} "$INSTDIR\${FileMainEXE}"
    ClearErrors
  ${EndIf}

  ; Unregister resources associated with Win7 taskbar jump lists.
  ApplicationID::UninstallJumpLists "${AppUserModelID}"

  ClearErrors
  ${un.RegCleanMain} "Software\Zotero"
  ${un.RegCleanUninstall}
  ${un.DeleteShortcuts}
  ${un.SetAppLSPCategories}
  
  ${un.RegCleanProtocolHandler} "zotero"
  ${un.RegCleanAppHandler} "ZoteroRIS"
  ${un.RegCleanAppHandler} "ZoteroISI"
  ${un.RegCleanAppHandler} "ZoteroMODS"
  ${un.RegCleanAppHandler} "ZoteroRDF"
  ${un.RegCleanAppHandler} "ZoteroBibTeX"
  ${un.RegCleanAppHandler} "ZoteroMARC"
  ${un.RegCleanAppHandler} "ZoteroCSL"

  ClearErrors
  ReadRegStr $R9 HKCR "ZoteroRDF" ""
  ; Don't clean up the file handlers if the ZoteroRDF key still exists since
  ; there should be a second installation that may be the default file handler
  ${If} ${Errors}
    ${un.RegCleanFileHandler}  ".rdf"    "ZoteroRDF"
    ${un.RegCleanFileHandler}  ".ris"    "ZoteroRIS"
    ${un.RegCleanFileHandler}  ".isi"    "ZoteroISI"
    ${un.RegCleanFileHandler}  ".mods"   "ZoteroMODS"
    ${un.RegCleanFileHandler}  ".bib"    "ZoteroBibTeX"
    ${un.RegCleanFileHandler}  ".bibtex" "ZoteroBibTeX"
    ${un.RegCleanFileHandler}  ".marc"   "ZoteroMARC"
    ${un.RegCleanFileHandler}  ".csl"    "ZoteroCSL"
  ${EndIf}

  ${un.GetSecondInstallPath} "Software\Zotero" $R9

  StrCpy $0 "Software\Microsoft\Windows\CurrentVersion\App Paths\${FileMainEXE}"
  ${If} $R9 == "false"
    DeleteRegKey SHCTX "$0"
    StrCpy $0 "Software\Classes\MIME\Database\Content Type\application/x-xpinstall;app=firefox"
    DeleteRegKey SHCTX "$0"
  ${Else}
    ReadRegStr $R1 SHCTX "$0" ""
    Push $R1
    Call un.RemoveQuotesFromPath
    Pop $R1
    ${un.GetParent} "$R1" $R1
    ${If} "$INSTDIR" == "$R1"
      WriteRegStr SHCTX "$0" "" "$R9"
      ${un.GetParent} "$R9" $R1
      WriteRegStr SHCTX "$0" "Path" "$R1"
    ${EndIf}
  ${EndIf}

  ; Remove directories and files we always control before parsing the uninstall
  ; log so empty directories can be removed.
  ${If} ${FileExists} "$INSTDIR\updates"
    RmDir /r /REBOOTOK "$INSTDIR\updates"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\defaults\shortcuts"
    RmDir /r /REBOOTOK "$INSTDIR\defaults\shortcuts"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\distribution"
    RmDir /r /REBOOTOK "$INSTDIR\distribution"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\removed-files"
    Delete /REBOOTOK "$INSTDIR\removed-files"
  ${EndIf}

  ; Remove the updates directory for Vista and above
  ${un.CleanUpdatesDir} "Zotero\Zotero"

  ; Parse the uninstall log to unregister dll's and remove all installed
  ; files / directories this install is responsible for.
  ${un.ParseUninstallLog}

  ; Files that were added by an in-app update aren't currently being added to the uninstall log,
  ; so manually delete everything we know about as long as the directory name begins with "Zotero".
  ; We don't just delete the directory because we don't know for sure that the user didn't do
  ; something crazy like put their data directory in it.
  ${GetFileName} $INSTDIR $R1
  StrCpy $R2 $R1 6
  StrCmp $R2 "Zotero" +1 post_delete
  ${If} ${FileExists} "$INSTDIR\chrome"
    RMDir /r /REBOOTOK "$INSTDIR\chrome"
  ${EndIF}
  ${If} ${FileExists} "$INSTDIR\components"
    RMDir /r /REBOOTOK "$INSTDIR\components"
  ${EndIF}
  ${If} ${FileExists} "$INSTDIR\defaults"
    RMDir /r /REBOOTOK "$INSTDIR\defaults"
  ${EndIF}
  ${If} ${FileExists} "$INSTDIR\dictionaries"
    RMDir /r /REBOOTOK "$INSTDIR\dictionaries"
  ${EndIF}
  ${If} ${FileExists} "$INSTDIR\extensions"
    RMDir /r /REBOOTOK "$INSTDIR\extensions"
  ${EndIF}
  ${If} ${FileExists} "$INSTDIR\fonts"
    RMDir /r /REBOOTOK "$INSTDIR\fonts"
  ${EndIF}
  ${If} ${FileExists} "$INSTDIR\gmp-clearkey"
    RMDir /r /REBOOTOK "$INSTDIR\gmp-clearkey"
  ${EndIF}
  ${If} ${FileExists} "$INSTDIR\xulrunner"
    RMDir /r /REBOOTOK "$INSTDIR\xulrunner"
  ${EndIF}
  Delete /REBOOTOK "$INSTDIR\*.chk"
  Delete /REBOOTOK "$INSTDIR\*.dll"
  Delete /REBOOTOK "$INSTDIR\*.exe"
  Delete /REBOOTOK "$INSTDIR\Accessible.tlb"
  Delete /REBOOTOK "$INSTDIR\dependentlibs.list"
  Delete /REBOOTOK "$INSTDIR\firefox.VisualElementsManifest.xml"
  Delete /REBOOTOK "$INSTDIR\omni.ja"
  Delete /REBOOTOK "$INSTDIR\platform.ini"
  Delete /REBOOTOK "$INSTDIR\precomplete"
  Delete /REBOOTOK "$INSTDIR\voucher.bin"
  post_delete:
  
  ; Remove the uninstall directory that we control
  RmDir /r /REBOOTOK "$INSTDIR\uninstall"

  ; Remove the installation directory if it is empty
  ${RemoveDir} "$INSTDIR"

  ; If firefox.exe was successfully deleted yet we still need to restart to
  ; remove other files create a dummy firefox.exe.moz-delete to prevent the
  ; installer from allowing an install without restart when it is required
  ; to complete an uninstall.
  ${If} ${RebootFlag}
    ${Unless} ${FileExists} "$INSTDIR\${FileMainEXE}.moz-delete"
      FileOpen $0 "$INSTDIR\${FileMainEXE}.moz-delete" w
      FileWrite $0 "Will be deleted on restart"
      Delete /REBOOTOK "$INSTDIR\${FileMainEXE}.moz-delete"
      FileClose $0
    ${EndUnless}
  ${EndIf}

  ; Refresh desktop icons otherwise the start menu internet item won't be
  ; removed and other ugly things will happen like recreation of the app's
  ; clients registry key by the OS under some conditions.
  System::Call "shell32::SHChangeNotify(i ${SHCNE_ASSOCCHANGED}, i 0, i 0, i 0)"
SectionEnd

################################################################################
# Helper Functions

; Don't setup the survey controls, functions, etc. when the application has
; defined NO_UNINSTALL_SURVEY
!ifndef NO_UNINSTALL_SURVEY
Function un.Survey
  Exec "$\"$TmpVal$\" $\"${SurveyURL}$\""
FunctionEnd
!endif

################################################################################
# Language

!insertmacro MOZ_MUI_LANGUAGE 'baseLocale'
!verbose push
!verbose 3
!include "overrideLocale.nsh"
!include "customLocale.nsh"
!verbose pop

; Set this after the locale files to override it if it is in the locale. Using
; " " for BrandingText will hide the "Nullsoft Install System..." branding.
BrandingText " "

################################################################################
# Page pre, show, and leave functions

Function un.preWelcome
  ${If} ${FileExists} "$INSTDIR\distribution\modern-wizard.bmp"
    Delete "$PLUGINSDIR\modern-wizard.bmp"
    CopyFiles /SILENT "$INSTDIR\distribution\modern-wizard.bmp" "$PLUGINSDIR\modern-wizard.bmp"
  ${EndIf}
FunctionEnd

Function un.leaveWelcome
  ${If} ${FileExists} "$INSTDIR\${FileMainEXE}"
    Banner::show /NOUNLOAD "$(BANNER_CHECK_EXISTING)"

    ; If the message window has been found previously give the app an additional
    ; five seconds to close.
    ${If} "$TmpVal" == "FoundMessageWindow"
      Sleep 5000
    ${EndIf}

    ${PushFilesToCheck}

    ${un.CheckForFilesInUse} $TmpVal

    Banner::destroy

    ; If there are files in use $TmpVal will be "true"
    ${If} "$TmpVal" == "true"
      ; If the message window is found the call to ManualCloseAppPrompt will
      ; abort leaving the value of $TmpVal set to "FoundMessageWindow".
      StrCpy $TmpVal "FoundMessageWindow"
      ${un.ManualCloseAppPrompt} "${WindowClass}" "$(WARN_MANUALLY_CLOSE_APP_UNINSTALL)"
      ; If the message window is not found set $TmpVal to "true" so the restart
      ; required message is displayed.
      StrCpy $TmpVal "true"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function un.preConfirm
  ${If} ${FileExists} "$INSTDIR\distribution\modern-header.bmp"
  ${AndIf} $hHeaderBitmap == ""
    Delete "$PLUGINSDIR\modern-header.bmp"
    CopyFiles /SILENT "$INSTDIR\distribution\modern-header.bmp" "$PLUGINSDIR\modern-header.bmp"
    ${un.ChangeMUIHeaderImage} "$PLUGINSDIR\modern-header.bmp"
  ${EndIf}

  ; Setup the unconfirm.ini file for the Custom Uninstall Confirm Page
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Settings" NumFields "5"

  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 1" Type   "label"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 1" Text   "$(UN_CONFIRM_UNINSTALLED_FROM)"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 1" Left   "0"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 1" Right  "-1"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 1" Top    "5"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 1" Bottom "15"

  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 2" Type   "text"
  ; The contents of this control must be set as follows in the pre function
  ; ${MUI_INSTALLOPTIONS_READ} $1 "unconfirm.ini" "Field 2" "HWND"
  ; SendMessage $1 ${WM_SETTEXT} 0 "STR:$INSTDIR"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 2" State  ""
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 2" Left   "0"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 2" Right  "-1"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 2" Top    "17"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 2" Bottom "30"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 2" flags  "READONLY"

  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" Type   "checkbox"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" Text   "$(UN_REMOVE_PROFILES)"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" Left   "0"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" Right  "-1"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" Top    "40"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" Bottom "50"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" State  "0"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" flags  "NOTIFY"

  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 4" Type   "text"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 4" State   "$(UN_REMOVE_PROFILES_DESC)"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 4" Left   "0"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 4" Right  "-1"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 4" Top    "52"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 4" Bottom "120"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 4" flags  "MULTILINE|READONLY"

  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 5" Type   "label"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 5" Text   "$(UN_CONFIRM_CLICK)"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 5" Left   "0"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 5" Right  "-1"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 5" Top    "130"
  WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 5" Bottom "150"

  ${If} "$TmpVal" == "true"
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 6" Type   "label"
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 6" Text   "$(SUMMARY_REBOOT_REQUIRED_UNINSTALL)"
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 6" Left   "0"
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 6" Right  "-1"
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 6" Top    "35"
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 6" Bottom "45"

    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Settings" NumFields "6"

    ; To insert this control reset Top / Bottom for controls below this one
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" Top    "55"
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 3" Bottom "65"
    WriteINIStr "$PLUGINSDIR\unconfirm.ini" "Field 4" Top    "67"
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "$(UN_CONFIRM_PAGE_TITLE)" "$(UN_CONFIRM_PAGE_SUBTITLE)"
  ; The Summary custom page has a textbox that will automatically receive
  ; focus. This sets the focus to the Install button instead.
  !insertmacro MUI_INSTALLOPTIONS_INITDIALOG "unconfirm.ini"
  GetDlgItem $0 $HWNDPARENT 1
  ${MUI_INSTALLOPTIONS_READ} $1 "unconfirm.ini" "Field 4" "HWND"
  SetCtlColors $1 0x000000 0xFFFFEE
  ShowWindow $1 ${SW_HIDE}
  System::Call "user32::SetFocus(i r0, i 0x0007, i,i)i"
  ${MUI_INSTALLOPTIONS_READ} $1 "unconfirm.ini" "Field 2" "HWND"
  SendMessage $1 ${WM_SETTEXT} 0 "STR:$INSTDIR"
  !insertmacro MUI_INSTALLOPTIONS_SHOW
FunctionEnd

Function un.leaveConfirm
  ${MUI_INSTALLOPTIONS_READ} $0 "unconfirm.ini" "Settings" "State"
  StrCmp $0 "3" +1 continue
  ${MUI_INSTALLOPTIONS_READ} $0 "unconfirm.ini" "Field 3" "State"
  ${MUI_INSTALLOPTIONS_READ} $1 "unconfirm.ini" "Field 4" "HWND"
  StrCmp $0 1 +1 +3
  ShowWindow $1 ${SW_SHOW}
  Abort

  ShowWindow $1 ${SW_HIDE}
  Abort

  continue:

  ; Try to delete the app executable and if we can't delete it try to find the
  ; app's message window and prompt the user to close the app. This allows
  ; running an instance that is located in another directory. If for whatever
  ; reason there is no message window we will just rename the app's files and
  ; then remove them on restart if they are in use.
  ClearErrors
  ${DeleteFile} "$INSTDIR\${FileMainEXE}"
  ${If} ${Errors}
    ${un.ManualCloseAppPrompt} "${WindowClass}" "$(WARN_MANUALLY_CLOSE_APP_UNINSTALL)"
  ${EndIf}
FunctionEnd

!ifndef NO_UNINSTALL_SURVEY
Function un.preFinish
  ; Do not modify the finish page if there is a reboot pending
  ${Unless} ${RebootFlag}
    ; Setup the survey controls, functions, etc.
    StrCpy $TmpVal "SOFTWARE\Microsoft\IE Setup\Setup"
    ClearErrors
    ReadRegStr $0 HKLM $TmpVal "Path"
    ${If} ${Errors}
      !insertmacro MUI_INSTALLOPTIONS_WRITE "ioSpecial.ini" "settings" "NumFields" "3"
    ${Else}
      ExpandEnvStrings $0 "$0" ; this value will usually contain %programfiles%
      ${If} $0 != "\"
        StrCpy $0 "$0\"
      ${EndIf}
      StrCpy $0 "$0\iexplore.exe"
      ClearErrors
      GetFullPathName $TmpVal $0
      ${If} ${Errors}
        !insertmacro MUI_INSTALLOPTIONS_WRITE "ioSpecial.ini" "settings" "NumFields" "3"
      ${Else}
        ; When we add an optional action to the finish page the cancel button
        ; is enabled. This disables it and leaves the finish button as the
        ; only choice.
        !insertmacro MUI_INSTALLOPTIONS_WRITE "ioSpecial.ini" "settings" "cancelenabled" "0"
      ${EndIf}
    ${EndIf}
  ${EndUnless}
FunctionEnd
!endif

################################################################################
# Initialization Functions

Function .onInit
  ; Prevents breaking apps that don't use SetBrandNameVars
  !ifdef SetBrandNameVars
    ${SetBrandNameVars} "$EXEDIR\distribution\setup.ini"
  !endif

  ; Prevent launching the application when a reboot is required and this
  ; executable is the main application executable
  IfFileExists "$EXEDIR\${FileMainEXE}.moz-upgrade" +1 +4
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "$(WARN_RESTART_REQUIRED_UPGRADE)" IDNO +2
  Reboot
  Quit ; Nothing initialized so no need to call OnEndCommon

  ${GetParent} "$EXEDIR" $INSTDIR
  Push $INSTDIR
  Call GetLongPath
  Pop $INSTDIR
  IfFileExists "$INSTDIR\${FileMainEXE}" +2 +1
  Quit ; Nothing initialized so no need to call OnEndCommon

  ; Prevents breaking apps that don't use SetBrandNameVars
  !ifdef SetBrandNameVars
    ${SetBrandNameVars} "$INSTDIR\distribution\setup.ini"
  !endif

  ; Application update uses a directory named tobedeleted in the $INSTDIR to
  ; delete files on OS reboot when they are in use. Try to delete this
  ; directory if it exists.
  ${If} ${FileExists} "$INSTDIR\tobedeleted"
    RmDir /r "$INSTDIR\tobedeleted"
  ${EndIf}

  ; Prevent all operations (e.g. set as default, postupdate, etc.) when a
  ; reboot is required and the executable launched is helper.exe
  IfFileExists "$INSTDIR\${FileMainEXE}.moz-upgrade" +1 +4
  MessageBox MB_YESNO|MB_ICONEXCLAMATION "$(WARN_RESTART_REQUIRED_UPGRADE)" IDNO +2
  Reboot
  Quit ; Nothing initialized so no need to call OnEndCommon

  !ifdef HAVE_64BIT_BUILD
    SetRegView 64
  !endif

  ${GetParameters} $R0

  StrCmp "$R0" "" continue +1

  ; Update this user's shortcuts with the latest app user model id.
  ClearErrors
  ${GetOptions} "$R0" "/UpdateShortcutAppUserModelIds" $R2
  IfErrors postupdate +1
  ${UpdateShortcutAppModelIDs}  "$INSTDIR\${FileMainEXE}" "${AppUserModelID}" $R2
  StrCmp "$R2" "true" finish +1 ; true indicates that shortcuts have been updated
  Quit ; Nothing initialized so no need to call OnEndCommon

  ; Do not attempt to elevate. The application launching this executable is
  ; responsible for elevation if it is required.
  postupdate:
  ${WordReplace} "$R0" "$\"" "" "+" $R0
  ClearErrors
  ${GetOptions} "$R0" "/PostUpdate" $R2
  IfErrors continue +1
  ; If the uninstall.log does not exist don't perform post update
  ; operations. This prevents updating the registry for zip builds.
  IfFileExists "$EXEDIR\uninstall.log" +2 +1
  Quit ; Nothing initialized so no need to call OnEndCommon
  ${PostUpdate}
  ClearErrors
  ${GetOptions} "$R0" "/UninstallLog=" $R2
  IfErrors updateuninstalllog +1
  StrCmp "$R2" "" finish +1
  GetFullPathName $R3 "$R2"
  IfFileExists "$R3" +1 finish
  Delete "$INSTDIR\uninstall\*wizard*"
  Delete "$INSTDIR\uninstall\uninstall.log"
  CopyFiles /SILENT /FILESONLY "$R3" "$INSTDIR\uninstall\"
  ${GetParent} "$R3" $R4
  Delete "$R3"
  RmDir "$R4"
  GoTo finish

  ; Do not attempt to elevate. The application launching this executable is
  ; responsible for elevation if it is required.
  updateuninstalllog:
  ${UpdateUninstallLog}

  finish:
  ${UnloadUAC}
  System::Call "shell32::SHChangeNotify(i ${SHCNE_ASSOCCHANGED}, i 0, i 0, i 0)"
  Quit ; Nothing initialized so no need to call OnEndCommon

  continue:

  ; If the uninstall.log does not exist don't perform uninstall
  ; operations. This prevents running the uninstaller for zip builds.
  IfFileExists "$INSTDIR\uninstall\uninstall.log" +2 +1
  Quit ; Nothing initialized so no need to call OnEndCommon

  ; If we made it this far then this installer is being used as an uninstaller.
  WriteUninstaller "$EXEDIR\uninstaller.exe"

  ${Unless} ${Silent}
    ; Manually check for /S in the command line due to Bug 506867
    ClearErrors
    ${GetOptions} "$R0" "/S" $R2
    ${Unless} ${Errors}
      SetSilent silent
    ${Else}
      ; Support for the deprecated -ms command line argument.
      ClearErrors
      ${GetOptions} "$R0" "-ms" $R2
      ${Unless} ${Errors}
        SetSilent silent
      ${EndUnless}
    ${EndUnless}
  ${EndUnless}

  ${If} ${Silent}
    StrCpy $R1 "$\"$EXEDIR\uninstaller.exe$\" /S"
  ${Else}
    StrCpy $R1 "$\"$EXEDIR\uninstaller.exe$\""
  ${EndIf}

  ; When the uninstaller is launched it copies itself to the temp directory
  ; so it won't be in use so it can delete itself.
  ExecWait $R1
  ${DeleteFile} "$EXEDIR\uninstaller.exe"
  SetErrorLevel 0
  Quit ; Nothing initialized so no need to call OnEndCommon
FunctionEnd

Function un.onInit
  StrCpy $LANGUAGE 0

  ${un.GetParent} "$INSTDIR" $INSTDIR
  Push $INSTDIR
  Call un.GetLongPath
  Pop $INSTDIR
  ${Unless} ${FileExists} "$INSTDIR\${FileMainEXE}"
  Abort
  ${EndUnless}

  !ifdef HAVE_64BIT_BUILD
  SetRegView 64
  !endif

  ; Prevents breaking apps that don't use SetBrandNameVars
  !ifdef un.SetBrandNameVars
  ${un.SetBrandNameVars} "$INSTDIR\distribution\setup.ini"
  !endif

  ; Initialize $hHeaderBitmap to prevent redundant changing of the bitmap if
  ; the user clicks the back button
  StrCpy $hHeaderBitmap ""

  !insertmacro InitInstallOptionsFile "unconfirm.ini"
FunctionEnd

Function .onGUIEnd
  ${OnEndCommon}
FunctionEnd

Function un.onGUIEnd
  ${un.OnEndCommon}
FunctionEnd

; Deletes all relative profiles specified in an application's profiles.ini and
; performs various other cleanup.

; The SetShellVarContext setting should be set to current before calling this
; function.

; @0  =   _REL_PROFILE_PATH
;         The relative path to the profile directory.

; $R6 = value of IsRelative read from profiles.ini
; $R7 = value of Path to profile read from profiles.ini
; $R8 = counter for reading profiles (e.g. Profile0, Profile1, etc.)
; $R9 = _REL_PROFILE_PATH

Function un.DeleteRelativeProfiles
  Exch $R9
  Push $R8
  Push $R7
  Push $R6

  StrCpy $R8 -1

  loop:
  IntOp $R8 $R8 + 1  ; Increment the counter.
  ReadINIStr $R7 "$APPDATA\$R9\profiles.ini" "Profile$R8" "Path"
  IfErrors end +1

  ; Only remove relative profiles
  ReadINIStr $R6 "$APPDATA\$R9\profiles.ini" "Profile$R8" "IsRelative"
  StrCmp "$R6" "1" +1 loop

  ; Relative paths in profiles.ini use / as a separator
  ${un.WordReplace} "$R7" "/" "\" "+" $R7

  IfFileExists "$LOCALAPPDATA\$R9\$R7" +1 +2
  RmDir /r "$LOCALAPPDATA\$R9\$R7"
  IfFileExists "$APPDATA\$R9\$R7" +1 +2
  RmDir /r "$APPDATA\$R9\$R7"
  GoTo loop

  end:
  ; Remove profiles directory under LOCALAPPDATA (e.g. cache, etc.) since
  ; they are at times abandoned.
  RmDir /r "$LOCALAPPDATA\$R9\Profiles"
  RmDir /r "$APPDATA\$R9\Crash Reports"
  Delete "$APPDATA\$R9\profiles.ini"
  Delete "$APPDATA\$R9\console.log"
  Delete "$APPDATA\$R9\pluginreg.dat"
  RmDir "$APPDATA\$R9\Profiles"
  RmDir "$APPDATA\$R9"

  Pop $R6
  Pop $R7
  Pop $R8
  Pop $R9
FunctionEnd

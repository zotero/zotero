# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Required Plugins:
# AppAssocReg   http://nsis.sourceforge.net/Application_Association_Registration_plug-in
# ApplicationID http://nsis.sourceforge.net/ApplicationID_plug-in
# ShellLink     http://nsis.sourceforge.net/ShellLink_plug-in
# UAC           http://nsis.sourceforge.net/UAC_plug-in

; Set verbosity to 2 to lessen the noise in the build logs
!verbose 2

; TODO 7-Zip provides better compression than the lzma from NSIS so we add the files
; uncompressed and use 7-Zip to create a SFX archive of it
SetDatablockOptimize on
SetCompress off
#SetCompressor lzma
CRCCheck on

RequestExecutionLevel user

!addplugindir ./

Var PageName

; These user preferences are initialized to default values in .onInit. They
; should only be changed in the UI, .ini handler, or command-line argument
; handlers.
Var AddDesktopSC
Var AddQuickLaunchSC
Var AddStartMenuSC
Var InstallType

; By defining NO_STARTMENU_DIR an installer that doesn't provide an option for
; an application's Start Menu PROGRAMS directory and doesn't define the
; StartMenuDir variable can use the common InstallOnInitCommon macro.
!define NO_STARTMENU_DIR

; On Vista and above attempt to elevate Standard Users in addition to users that
; are a member of the Administrators group.
!define NONADMIN_ELEVATE

!define AbortSurveyURL "http://www.kampyle.com/feedback_form/ff-feedback-form.php?site_code=8166124&form_id=12116&url="

; Other included files may depend upon these includes!
; The following includes are provided by NSIS.
!include FileFunc.nsh
!include LogicLib.nsh
!include MUI.nsh
!include WinMessages.nsh
!include WinVer.nsh
!include WordFunc.nsh

!insertmacro GetOptions
!insertmacro GetParameters
!insertmacro GetSize
!insertmacro StrFilter
!insertmacro WordFind
!insertmacro WordReplace

; The following includes are custom.
!include branding.nsi
!include defines.nsi
!include common.nsh
!include locales.nsi

VIAddVersionKey "FileDescription" "${BrandShortName} Installer"
VIAddVersionKey "OriginalFilename" "setup.exe"

; Must be inserted before other macros that use logging
!insertmacro _LoggingCommon

!insertmacro AddHandlerValues
!insertmacro CanWriteToInstallDir
!insertmacro ChangeMUIHeaderImage
!insertmacro CheckDiskSpace
!insertmacro CheckForFilesInUse
!insertmacro CleanUpdatesDir
!insertmacro CopyFilesFromDir
!insertmacro GetParent
!insertmacro GetPathFromString
!insertmacro IsHandlerForInstallDir
!insertmacro LogDesktopShortcut
!insertmacro LogQuickLaunchShortcut
!insertmacro LogStartMenuShortcut
!insertmacro ManualCloseAppPrompt
!insertmacro RegCleanMain
!insertmacro RegCleanUninstall
!insertmacro SetAppLSPCategories
!insertmacro SetBrandNameVars
!insertmacro UnloadUAC
!insertmacro UpdateShortcutAppModelIDs
!insertmacro WriteRegDWORD2
!insertmacro WriteRegStr2

!include shared.nsh

; Helper macros for ui callbacks. Insert these after shared.nsh
!insertmacro InstallEndCleanupCommon
!insertmacro InstallOnInitCommon
!insertmacro InstallStartCleanupCommon
!insertmacro LeaveOptionsCommon
!insertmacro OnEndCommon

Name "${BrandFullName}"
OutFile "setup.exe"
!ifdef HAVE_64BIT_BUILD
  InstallDir "$PROGRAMFILES64\${BrandFullName}\"
!else
  InstallDir "$PROGRAMFILES32\${BrandFullName}\"
!endif
ShowInstDetails nevershow

################################################################################
# Modern User Interface - MUI

!define MOZ_MUI_CUSTOM_ABORT
!define MUI_CUSTOMFUNCTION_ABORT "CustomAbort"
!define MUI_ICON setup.ico
!define MUI_UNICON setup.ico
!define MUI_WELCOMEPAGE_TITLE_3LINES
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
#TODO !define MUI_WELCOMEFINISHPAGE_BITMAP wizWatermark.bmp

; Use a right to left header image when the language is right to left
#TODO !ifdef ${AB_CD}_rtl
#TODO !define MUI_HEADERIMAGE_BITMAP_RTL wizHeaderRTL.bmp
#TODO !else
#TODO !define MUI_HEADERIMAGE_BITMAP wizHeader.bmp
#TODO !endif

/**
 * Installation Pages
 */
; Welcome Page
!define MUI_PAGE_CUSTOMFUNCTION_PRE preWelcome
!insertmacro MUI_PAGE_WELCOME

; Custom Options Page
Page custom preOptions leaveOptions

; Select Install Directory Page
!define MUI_PAGE_CUSTOMFUNCTION_PRE preDirectory
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE leaveDirectory
!define MUI_DIRECTORYPAGE_VERIFYONLEAVE
!insertmacro MUI_PAGE_DIRECTORY

; Custom Shortcuts Page
Page custom preShortcuts leaveShortcuts

; Custom Summary Page
Page custom preSummary

; Install Files Page
!insertmacro MUI_PAGE_INSTFILES

; Finish Page
!define MUI_FINISHPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_RUN
!define MUI_FINISHPAGE_RUN_FUNCTION LaunchApp
!define MUI_FINISHPAGE_RUN_TEXT $(LAUNCH_TEXT)
!define MUI_PAGE_CUSTOMFUNCTION_PRE preFinish
!insertmacro MUI_PAGE_FINISH

; Use the default dialog for IDD_VERIFY for a simple Banner
ChangeUI IDD_VERIFY "${NSISDIR}\Contrib\UIs\default.exe"

; If a version beginning with $R1 is installed, uninstall that.
; This is used to uninstall the old Zotero Standalone installer and a 32-bit version on 64-bit Windows
Function UninstallOld
  Push $R1
  Push $R2
  StrCpy $0 0

  enum_uninst_keys:
    EnumRegKey $1 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall" $0
    StrCmp $1 "" continue_installation
    ; $R1 is "Zotero", registry key name contains version and locale e.g. "Zotero 6.0.0 (x86 en-US)" so:
    StrLen $3 $R1 ; $3 = length of $R1, e.g. 6 for "Zotero"
    StrCpy $2 $1 $3 ; $2 = first $3 characters of $1, i.e. name without version and locale, e.g. "Zotero"
    StrCmp $2 $R1 get_uninst_exe ; if the key we found is the one we're looking for (e.g. "Zotero"), go to get_uninst_exe
    IntOp $0 $0 + 1 
    Goto enum_uninst_keys ; loop through all keys

  get_uninst_exe:
    ReadRegStr $2 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "UninstallString"
    ReadRegStr $3 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\$1" "InstallLocation"

  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
    $R2 \
    /SD IDOK IDOK uninst
  Abort

  uninst:
    ; This doesn't actually wait, since the uninstaller copies itself to a temp folder, runs that,
    ; and exits, so give it a few seconds to finish
    ExecWait '"$2" /S'
    Sleep 3000

    ; Files that were added by an in-app update won't be automatically deleted by the 4.0 uninstaller,
    ; so manually delete everything we know about as long as the directory name begins with "Zotero".
    ; We don't just delete the directory because we don't know for sure that the user didn't do
    ; something crazy like put their data directory in it.
    ${GetFileName} $3 $4
    StrCpy $5 $4 6
    StrCmp $5 "Zotero" +1 continue_installation
    RMDir /r /REBOOTOK "$3\chrome"
    RMDir /r /REBOOTOK "$3\components"
    RMDir /r /REBOOTOK "$3\defaults"
    RMDir /r /REBOOTOK "$3\dictionaries"
    RMDir /r /REBOOTOK "$3\extensions"
    RMDir /r /REBOOTOK "$3\fonts"
    RMDir /r /REBOOTOK "$3\gmp-clearkey"
    RMDir /r /REBOOTOK "$3\uninstall"
    RMDir /r /REBOOTOK "$3\xulrunner"
    Delete /REBOOTOK "$3\*.chk"
    Delete /REBOOTOK "$3\*.dll"
    Delete /REBOOTOK "$3\*.exe"
    Delete /REBOOTOK "$3\Accessible.tlb"
    Delete /REBOOTOK "$3\dependentlibs.list"
    Delete /REBOOTOK "$3\firefox.VisualElementsManifest.xml"
    Delete /REBOOTOK "$3\omni.ja"
    Delete /REBOOTOK "$3\platform.ini"
    Delete /REBOOTOK "$3\precomplete"
    Delete /REBOOTOK "$3\voucher.bin"
    RMDir /REBOOTOK $3
  continue_installation:
    ; End uninstallation
    Pop $R2
    Pop $R1
FunctionEnd

################################################################################
# Install Sections

; Cleanup operations to perform at the start of the installation.
Section "-InstallStartCleanup"
  ; I don't know that software upgrades are working correctly, but this
  ; ensures that CheckExistingInstall always gets called.
  IfSilent +1 non_silent
    ; code from options page that needs to execute
    ${LeaveOptionsCommon}

    ; code from last page shown (depending on installtype) that needs to
    ; execute.
    Call CheckExistingInstall

    Push $R9
    ${CanWriteToInstallDir} $R9
    ${If} $R9 == "false"
      ; TODO: write to log file
      Abort
    ${EndIf}

    ${CheckDiskSpace} $R9
    ${If} $R9 == "false"
      ; TODO: write to log file
      Abort
    ${EndIf}
    Pop $R9

  non_silent:
  ; Try to delete the app executable and if we can't delete it try to find the
  ; app's message window and prompt the user to close the app. This allows
  ; running an instance that is located in another directory. If for whatever
  ; reason there is no message window we will just rename the app's files and
  ; then remove them on restart.
  ClearErrors
  ${DeleteFile} "$INSTDIR\${FileMainEXE}"
  ${If} ${Errors}
    ${ManualCloseAppPrompt} "${WindowClass}" "$(WARN_MANUALLY_CLOSE_APP_INSTALL)"
  ${EndIf}

  SetDetailsPrint both
  DetailPrint $(STATUS_CLEANUP)
  SetDetailsPrint none

  SetOutPath "$INSTDIR"
  ${StartInstallLog} "${BrandFullName}" "${AB_CD}" "${AppVersion}" "${GREVersion}"

  ; Delete the app exe to prevent launching the app while we are installing.
  ClearErrors
  ${DeleteFile} "$INSTDIR\${FileMainEXE}"
  ${If} ${Errors}
    ; If the user closed the application it can take several seconds for it to
    ; shut down completely. If the application is being used by another user we
    ; can rename the file and then delete is when the system is restarted.
    Sleep 5000
    ${DeleteFile} "$INSTDIR\${FileMainEXE}"
    ClearErrors
  ${EndIf}

  ; Remove the updates directory for Vista and above
  ${CleanUpdatesDir} "Zotero\Zotero"


  ${InstallStartCleanupCommon}
SectionEnd

Section "-Application" APP_IDX
  ${StartUninstallLog}

  SetDetailsPrint both
  DetailPrint $(STATUS_INSTALL_APP)
  SetDetailsPrint none

  ${LogHeader} "Installing Main Files"
  ${CopyFilesFromDir} "$EXEDIR\core" "$INSTDIR" \
                      "$(ERROR_CREATE_DIRECTORY_PREFIX)" \
                      "$(ERROR_CREATE_DIRECTORY_SUFFIX)"

  ; Register DLLs
  ; XXXrstrong - AccessibleMarshal.dll can be used by multiple applications but
  ; is only registered for the last application installed. When the last
  ; application installed is uninstalled AccessibleMarshal.dll will no longer be
  ; registered. bug 338878
  ${LogHeader} "DLL Registration"
  ClearErrors
  ${RegisterDLL} "$INSTDIR\AccessibleMarshal.dll"
  ${If} ${Errors}
    ${LogMsg} "** ERROR Registering: $INSTDIR\AccessibleMarshal.dll **"
  ${Else}
    ${LogUninstall} "DLLReg: \AccessibleMarshal.dll"
    ${LogMsg} "Registered: $INSTDIR\AccessibleMarshal.dll"
  ${EndIf}

  ; Write extra files created by the application to the uninstall log so they
  ; will be removed when the application is uninstalled. To remove an empty
  ; directory write a bogus filename to the deepest directory and all empty
  ; parent directories will be removed.
  ${LogUninstall} "File: \components\compreg.dat"
  ${LogUninstall} "File: \components\xpti.dat"
  ${LogUninstall} "File: \active-update.xml"
  ${LogUninstall} "File: \install.log"
  ${LogUninstall} "File: \install_status.log"
  ${LogUninstall} "File: \install_wizard.log"
  ${LogUninstall} "File: \updates.xml"

  ClearErrors

  ${LogHeader} "Adding Registry Entries"
  SetShellVarContext current  ; Set SHCTX to HKCU
  ${RegCleanMain} "Software\Zotero"
  ${RegCleanUninstall}
  ${UpdateProtocolHandlers}

  ClearErrors
  WriteRegStr HKLM "Software\Zotero" "${BrandShortName}InstallerTest" "Write Test"
  ${If} ${Errors}
    StrCpy $TmpVal "HKCU" ; used primarily for logging
  ${Else}
    SetShellVarContext all  ; Set SHCTX to HKLM
    DeleteRegValue HKLM "Software\Zotero" "${BrandShortName}InstallerTest"
    StrCpy $TmpVal "HKLM" ; used primarily for logging
    ${RegCleanMain} "Software\Zotero"
    ${RegCleanUninstall}
    ${UpdateProtocolHandlers}

    ReadRegStr $0 HKLM "Software\zotero.org\Zotero" "CurrentVersion"
    ${If} "$0" != "${GREVersion}"
      WriteRegStr HKLM "Software\zotero.org\Zotero" "CurrentVersion" "${GREVersion}"
    ${EndIf}
  ${EndIf}

  ; The order that reg keys and values are added is important if you use the
  ; uninstall log to remove them on uninstall. When using the uninstall log you
  ; MUST add children first so they will be removed first on uninstall so they
  ; will be empty when the key is deleted. This allows the uninstaller to
  ; specify that only empty keys will be deleted.
  ${SetAppKeys}

  ${FixClassKeys}

  ; Uninstall keys can only exist under HKLM on some versions of windows. Since
  ; it doesn't cause problems always add them.
  ${SetUninstallKeys}
  
  ; Register zotero protocol handler
  ${SetHandlers}

  ; These need special handling on uninstall since they may be overwritten by
  ; an install into a different location.
  StrCpy $0 "Software\Microsoft\Windows\CurrentVersion\App Paths\${FileMainEXE}"
  ${WriteRegStr2} $TmpVal "$0" "" "$INSTDIR\${FileMainEXE}" 0
  ${WriteRegStr2} $TmpVal "$0" "Path" "$INSTDIR" 0

  ${If} $TmpVal == "HKLM"
    ; Set the permitted LSP Categories for WinVista and above
    ${SetAppLSPCategories} ${LSP_CATEGORIES}
  ${EndIf}

  ; Create shortcuts
  ${LogHeader} "Adding Shortcuts"

  ; Remove the start menu shortcuts and directory if the SMPROGRAMS section
  ; exists in the shortcuts_log.ini and the SMPROGRAMS. The installer's shortcut
  ; creation code will create the shortcut in the root of the Start Menu
  ; Programs directory.
  ${RemoveStartMenuDir}

  ; Always add the application's shortcuts to the shortcuts log ini file. The
  ; DeleteShortcuts macro will do the right thing on uninstall if the
  ; shortcuts don't exist.
  ${LogStartMenuShortcut} "${BrandFullName}.lnk"
  ${LogQuickLaunchShortcut} "${BrandFullName}.lnk"
  ${LogDesktopShortcut} "${BrandFullName}.lnk"

  ; Best effort to update the Win7 taskbar and start menu shortcut app model
  ; id's. The possible contexts are current user / system and the user that
  ; elevated the installer.
  Call FixShortcutAppModelIDs
  ; If the current context is all also perform Win7 taskbar and start menu link
  ; maintenance for the current user context.
  ${If} $TmpVal == "HKLM"
    SetShellVarContext current  ; Set SHCTX to HKCU
    Call FixShortcutAppModelIDs
    SetShellVarContext all  ; Set SHCTX to HKLM
  ${EndIf}

  ; If running elevated also perform Win7 taskbar and start menu link
  ; maintenance for the unelevated user context in case that is different than
  ; the current user.
  ClearErrors
  ${GetParameters} $0
  ${GetOptions} "$0" "/UAC:" $0
  ${Unless} ${Errors}
    GetFunctionAddress $0 FixShortcutAppModelIDs
    UAC::ExecCodeSegment $0
  ${EndUnless}

  ; UAC only allows elevating to an Admin account so there is no need to add
  ; the Start Menu or Desktop shortcuts from the original unelevated process
  ; since this will either add it for the user if unelevated or All Users if
  ; elevated.
  ${If} $AddStartMenuSC == ${START_MENU_SHORTCUT_ENABLED}
    CreateShortCut "$SMPROGRAMS\${BrandFullName}.lnk" "$INSTDIR\${FileMainEXE}"
    ${If} ${FileExists} "$SMPROGRAMS\${BrandFullName}.lnk"
      ShellLink::SetShortCutWorkingDirectory "$SMPROGRAMS\${BrandFullName}.lnk" \
                                           "$INSTDIR"
      ${If} ${AtLeastWin7}
        ApplicationID::Set "$SMPROGRAMS\${BrandFullName}.lnk" "${AppUserModelID}"
      ${EndIf}
      ${LogMsg} "Added Shortcut: $SMPROGRAMS\${BrandFullName}.lnk"
    ${Else}
      ${LogMsg} "** ERROR Adding Shortcut: $SMPROGRAMS\${BrandFullName}.lnk"
    ${EndIf}
  ${EndIf}

  ${If} $AddDesktopSC == ${DESKTOP_SHORTCUT_ENABLED}
    CreateShortCut "$DESKTOP\${BrandFullName}.lnk" "$INSTDIR\${FileMainEXE}"
    ${If} ${FileExists} "$DESKTOP\${BrandFullName}.lnk"
      ShellLink::SetShortCutWorkingDirectory "$DESKTOP\${BrandFullName}.lnk" \
                                             "$INSTDIR"
      ${If} ${AtLeastWin7}
        ApplicationID::Set "$DESKTOP\${BrandFullName}.lnk" "${AppUserModelID}"
      ${EndIf}
      ${LogMsg} "Added Shortcut: $DESKTOP\${BrandFullName}.lnk"
    ${Else}
      ${LogMsg} "** ERROR Adding Shortcut: $DESKTOP\${BrandFullName}.lnk"
    ${EndIf}
  ${EndIf}

  ; If elevated the Quick Launch shortcut must be added from the unelevated
  ; original process.
  ${If} $AddQuickLaunchSC == ${QUICKLAUNCH_SHORTCUT_ENABLED}
    ${Unless} ${AtLeastWin7}
      ClearErrors
      ${GetParameters} $0
      ${GetOptions} "$0" "/UAC:" $0
      ${If} ${Errors}
        Call AddQuickLaunchShortcut
        ${LogMsg} "Added Shortcut: $QUICKLAUNCH\${BrandFullName}.lnk"
      ${Else}
        ; It is not possible to add a log entry from the unelevated process so
        ; add the log entry without the path since there is no simple way to
        ; know the correct full path.
        ${LogMsg} "Added Quick Launch Shortcut: ${BrandFullName}.lnk"
        GetFunctionAddress $0 AddQuickLaunchShortcut
        UAC::ExecCodeSegment $0
      ${EndIf}
    ${EndUnless}
  ${EndIf}
SectionEnd

; Cleanup operations to perform at the end of the installation.
Section "-InstallEndCleanup"
  SetDetailsPrint both
  DetailPrint "$(STATUS_CLEANUP)"
  SetDetailsPrint none

  ; Refresh desktop icons
  System::Call "shell32::SHChangeNotify(i ${SHCNE_ASSOCCHANGED}, i ${SHCNF_DWORDFLUSH}, i 0, i 0)"

  ${InstallEndCleanupCommon}

  ${If} ${RebootFlag}
    ; When a reboot is required give SHChangeNotify time to finish the
    ; refreshing the icons so the OS doesn't display the icons from helper.exe
    Sleep 10000
    ${LogHeader} "Reboot Required To Finish Installation"
    ; ${FileMainEXE}.moz-upgrade should never exist but just in case...
    ${Unless} ${FileExists} "$INSTDIR\${FileMainEXE}.moz-upgrade"
      Rename "$INSTDIR\${FileMainEXE}" "$INSTDIR\${FileMainEXE}.moz-upgrade"
    ${EndUnless}

    ${If} ${FileExists} "$INSTDIR\${FileMainEXE}"
      ClearErrors
      Rename "$INSTDIR\${FileMainEXE}" "$INSTDIR\${FileMainEXE}.moz-delete"
      ${Unless} ${Errors}
        Delete /REBOOTOK "$INSTDIR\${FileMainEXE}.moz-delete"
      ${EndUnless}
    ${EndIf}

    ${Unless} ${FileExists} "$INSTDIR\${FileMainEXE}"
      CopyFiles /SILENT "$INSTDIR\uninstall\helper.exe" "$INSTDIR"
      FileOpen $0 "$INSTDIR\${FileMainEXE}" w
      FileWrite $0 "Will be deleted on restart"
      Rename /REBOOTOK "$INSTDIR\${FileMainEXE}.moz-upgrade" "$INSTDIR\${FileMainEXE}"
      FileClose $0
      Delete "$INSTDIR\${FileMainEXE}"
      Rename "$INSTDIR\helper.exe" "$INSTDIR\${FileMainEXE}"
    ${EndUnless}
  ${EndIf}
SectionEnd

################################################################################
# Install Abort Survey Functions

Function CustomAbort
  ${If} "${AB_CD}" == "en-US"
  ${AndIf} "$PageName" != ""
  ${AndIf} ${FileExists} "$EXEDIR\core\distribution\distribution.ini"
    ReadINIStr $0 "$EXEDIR\core\distribution\distribution.ini" "Global" "about"
    ClearErrors
    ${WordFind} "$0" "Funnelcake" "E#" $1
    ${Unless} ${Errors}
      ; Yes = fill out the survey and exit, No = don't fill out survey and exit,
      ; Cancel = don't exit.
      MessageBox MB_YESNO|MB_ICONEXCLAMATION \
                 "Would you like to tell us why you are canceling this installation?" \
                 IDYes +1 IDNO CustomAbort_finish
      ${If} "$PageName" == "Welcome"
          GetFunctionAddress $0 AbortSurveyWelcome
      ${ElseIf} "$PageName" == "Options"
          GetFunctionAddress $0 AbortSurveyOptions
      ${ElseIf} "$PageName" == "Directory"
          GetFunctionAddress $0 AbortSurveyDirectory
      ${ElseIf} "$PageName" == "Shortcuts"
          GetFunctionAddress $0 AbortSurveyShortcuts
      ${ElseIf} "$PageName" == "Summary"
          GetFunctionAddress $0 AbortSurveySummary
      ${EndIf}
      ClearErrors
      ${GetParameters} $1
      ${GetOptions} "$1" "/UAC:" $2
      ${If} ${Errors}
        Call $0
      ${Else}
        UAC::ExecCodeSegment $0
      ${EndIf}

      CustomAbort_finish:
      Return
    ${EndUnless}
  ${EndIf}

  MessageBox MB_YESNO|MB_ICONEXCLAMATION "$(MOZ_MUI_TEXT_ABORTWARNING)" \
             IDYES +1 IDNO +2
  Return
  Abort
FunctionEnd

Function AbortSurveyWelcome
  ExecShell "open" "${AbortSurveyURL}step1"
FunctionEnd

Function AbortSurveyOptions
  ExecShell "open" "${AbortSurveyURL}step2"
FunctionEnd

Function AbortSurveyDirectory
  ExecShell "open" "${AbortSurveyURL}step3"
FunctionEnd

Function AbortSurveyShortcuts
  ExecShell "open" "${AbortSurveyURL}step4"
FunctionEnd

Function AbortSurveySummary
  ExecShell "open" "${AbortSurveyURL}step5"
FunctionEnd

################################################################################
# Helper Functions

Function AddQuickLaunchShortcut
  CreateShortCut "$QUICKLAUNCH\${BrandFullName}.lnk" "$INSTDIR\${FileMainEXE}"
  ${If} ${FileExists} "$QUICKLAUNCH\${BrandFullName}.lnk"
    ShellLink::SetShortCutWorkingDirectory "$QUICKLAUNCH\${BrandFullName}.lnk" \
                                           "$INSTDIR"
  ${EndIf}
FunctionEnd

Function CheckExistingInstall
  ; If there is a pending file copy from a previous upgrade don't allow
  ; installing until after the system has rebooted.
  IfFileExists "$INSTDIR\${FileMainEXE}.moz-upgrade" +1 +5
  MessageBox MB_YESNOCANCEL|MB_ICONEXCLAMATION "$(WARN_RESTART_REQUIRED_UPGRADE)" IDNO +3 IDCANCEL +2
  Reboot
  Quit
  RMDir /r $INSTDIR

  IfFileExists "$INSTDIR\${FileMainEXE}.moz-upgrade" +1 +3
  MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to remove the previous installation. Please delete $INSTDIR and try again."
  Quit

  ; If there is a pending file deletion from a previous uninstall don't allow
  ; installing until after the system has rebooted.
  IfFileExists "$INSTDIR\${FileMainEXE}.moz-delete" +1 +5
  MessageBox MB_YESNOCANCEL|MB_ICONEXCLAMATION "$(WARN_RESTART_REQUIRED_UNINSTALL)" IDNO +3 IDCANCEL +2
  Reboot
  Quit
  RMDir /r $INSTDIR

  IfFileExists "$INSTDIR\${FileMainEXE}.moz-delete" +1 +3
  MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to remove the previous installation. Please delete $INSTDIR and try again."
  Quit

  ${If} ${FileExists} "$INSTDIR\${FileMainEXE}"
    ; Disable the next, cancel, and back buttons
    GetDlgItem $0 $HWNDPARENT 1 ; Next button
    EnableWindow $0 0
    GetDlgItem $0 $HWNDPARENT 2 ; Cancel button
    EnableWindow $0 0
    GetDlgItem $0 $HWNDPARENT 3 ; Back button
    EnableWindow $0 0

    Banner::show /NOUNLOAD "$(BANNER_CHECK_EXISTING)"

    ${If} "$TmpVal" == "FoundMessageWindow"
      Sleep 5000
    ${EndIf}

    ${PushFilesToCheck}

    ; Store the return value in $TmpVal so it is less likely to be accidentally
    ; overwritten elsewhere.
    ${CheckForFilesInUse} $TmpVal

    Banner::destroy

    ; Enable the next, cancel, and back buttons
    GetDlgItem $0 $HWNDPARENT 1 ; Next button
    EnableWindow $0 1
    GetDlgItem $0 $HWNDPARENT 2 ; Cancel button
    EnableWindow $0 1
    GetDlgItem $0 $HWNDPARENT 3 ; Back button
    EnableWindow $0 1

    ${If} "$TmpVal" == "true"
      StrCpy $TmpVal "FoundMessageWindow"
      ${ManualCloseAppPrompt} "${WindowClass}" "$(WARN_MANUALLY_CLOSE_APP_INSTALL)"
      StrCpy $TmpVal "true"
    ${EndIf}
  ${EndIf}
FunctionEnd

Function LaunchApp
  ${ManualCloseAppPrompt} "${WindowClass}" "$(WARN_MANUALLY_CLOSE_APP_LAUNCH)"

  ClearErrors
  ${GetParameters} $0
  ${GetOptions} "$0" "/UAC:" $1
  ${If} ${Errors}
    Exec "$\"$INSTDIR\${FileMainEXE}$\""
  ${Else}
    GetFunctionAddress $0 LaunchAppFromElevatedProcess
    UAC::ExecCodeSegment $0
  ${EndIf}
FunctionEnd

Function LaunchAppFromElevatedProcess
  ; Find the installation directory when launching using GetFunctionAddress
  ; from an elevated installer since $INSTDIR will not be set in this installer
  ReadRegStr $0 HKLM "Software\Classes\zotero\DefaultIcon" ""
  ${GetPathFromString} "$0" $0
  ${GetParent} "$0" $1
  ; Set our current working directory to the application's install directory
  ; otherwise the 7-Zip temp directory will be in use and won't be deleted.
  SetOutPath "$1"
  Exec "$\"$0$\""
FunctionEnd

################################################################################
# Language

!insertmacro MOZ_MUI_LANGUAGE 'baseLocale'
!verbose push
!verbose 3
!include "overrideLocale.nsh"
!include "customLocale.nsh"
!verbose pop

; Set this after the locale files to override it if it is in the locale
; using " " for BrandingText will hide the "Nullsoft Install System..." branding
BrandingText " "

################################################################################
# Page pre, show, and leave functions

Function preWelcome
  StrCpy $PageName "Welcome"
  ${If} ${FileExists} "$EXEDIR\core\distribution\modern-wizard.bmp"
    Delete "$PLUGINSDIR\modern-wizard.bmp"
    CopyFiles /SILENT "$EXEDIR\core\distribution\modern-wizard.bmp" "$PLUGINSDIR\modern-wizard.bmp"
  ${EndIf}
FunctionEnd

Function preOptions
  StrCpy $PageName "Options"
  ${If} ${FileExists} "$EXEDIR\core\distribution\modern-header.bmp"
  ${AndIf} $hHeaderBitmap == ""
    Delete "$PLUGINSDIR\modern-header.bmp"
    CopyFiles /SILENT "$EXEDIR\core\distribution\modern-header.bmp" "$PLUGINSDIR\modern-header.bmp"
    ${ChangeMUIHeaderImage} "$PLUGINSDIR\modern-header.bmp"
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "$(OPTIONS_PAGE_TITLE)" "$(OPTIONS_PAGE_SUBTITLE)"
  !insertmacro MUI_INSTALLOPTIONS_DISPLAY "options.ini"
FunctionEnd

Function leaveOptions
  ${MUI_INSTALLOPTIONS_READ} $0 "options.ini" "Settings" "State"
  ${If} $0 != 0
    Abort
  ${EndIf}
  ${MUI_INSTALLOPTIONS_READ} $R0 "options.ini" "Field 2" "State"
  StrCmp $R0 "1" +1 +2
  StrCpy $InstallType ${INSTALLTYPE_BASIC}
  ${MUI_INSTALLOPTIONS_READ} $R0 "options.ini" "Field 3" "State"
  StrCmp $R0 "1" +1 +2
  StrCpy $InstallType ${INSTALLTYPE_CUSTOM}

  ${LeaveOptionsCommon}

  ${If} $InstallType == ${INSTALLTYPE_BASIC}
    Call CheckExistingInstall
  ${EndIf}
FunctionEnd

Function preDirectory
  StrCpy $PageName "Directory"
  Push $R9

  ; Skip page if currently drive space and disk access exist for currently
  ; selected install path.
  IntCmp $InstallType ${INSTALLTYPE_CUSTOM} end +1 +1
  ${CanWriteToInstallDir} $R9
  StrCmp "$R9" "false" end +1
  ${CheckDiskSpace} $R9
  StrCmp "$R9" "false" end +1
  Abort

  end:

  Pop $R9
FunctionEnd

Function leaveDirectory
  ${If} $InstallType == ${INSTALLTYPE_BASIC}
    Call CheckExistingInstall
  ${EndIf}

  ; Force user to try again if no drive space or disk access exist for
  ; currently selected install path.
  Push $R9
  ${CanWriteToInstallDir} $R9
  ${If} $R9 == "false"
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(WARN_WRITE_ACCESS)"
    Abort
  ${EndIf}

  ${CheckDiskSpace} $R9
  ${If} $R9 == "false"
    MessageBox MB_OK|MB_ICONEXCLAMATION "$(WARN_DISK_SPACE)"
    Abort
  ${EndIf}
  Pop $R9
FunctionEnd

Function preShortcuts
  StrCpy $PageName "Shortcuts"

  ; Abort if not a custom install
  IntCmp $InstallType ${INSTALLTYPE_CUSTOM} +2 +1 +1
  Abort

  !insertmacro MUI_HEADER_TEXT "$(SHORTCUTS_PAGE_TITLE)" "$(SHORTCUTS_PAGE_SUBTITLE)"
  !insertmacro MUI_INSTALLOPTIONS_DISPLAY "shortcuts.ini"
FunctionEnd

Function leaveShortcuts
  ${MUI_INSTALLOPTIONS_READ} $0 "shortcuts.ini" "Settings" "State"
  ${If} $0 != 0
    Abort
  ${EndIf}
  ${MUI_INSTALLOPTIONS_READ} $AddDesktopSC "shortcuts.ini" "Field 2" "State"
  ${MUI_INSTALLOPTIONS_READ} $AddStartMenuSC "shortcuts.ini" "Field 3" "State"
  ; This field doesn't exist when running on Windows 7 or above.
  ${Unless} ${AtLeastWin7}
    ${MUI_INSTALLOPTIONS_READ} $AddQuickLaunchSC "shortcuts.ini" "Field 4" "State"
  ${EndUnless}

  ${If} $InstallType == ${INSTALLTYPE_CUSTOM}
    Call CheckExistingInstall
  ${EndIf}
FunctionEnd

Function preSummary
  StrCpy $PageName "Summary"
  ; Setup the summary.ini file for the Custom Summary Page
  WriteINIStr "$PLUGINSDIR\summary.ini" "Settings" NumFields "3"

  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 1" Type   "label"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 1" Text   "$(SUMMARY_INSTALLED_TO)"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 1" Left   "0"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 1" Right  "-1"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 1" Top    "5"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 1" Bottom "15"

  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 2" Type   "text"
  ; The contents of this control must be set as follows in the pre function
  ; ${MUI_INSTALLOPTIONS_READ} $1 "summary.ini" "Field 2" "HWND"
  ; SendMessage $1 ${WM_SETTEXT} 0 "STR:$INSTDIR"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 2" state  ""
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 2" Left   "0"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 2" Right  "-1"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 2" Top    "17"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 2" Bottom "30"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 2" flags  "READONLY"

  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 3" Type   "label"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 3" Left   "0"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 3" Right  "-1"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 3" Top    "130"
  WriteINIStr "$PLUGINSDIR\summary.ini" "Field 3" Bottom "150"

  ${If} ${FileExists} "$INSTDIR\${FileMainEXE}"
    WriteINIStr "$PLUGINSDIR\summary.ini" "Field 3" Text "$(SUMMARY_UPGRADE_CLICK)"
    WriteINIStr "$PLUGINSDIR\summary.ini" "Settings" NextButtonText "$(UPGRADE_BUTTON)"
  ${Else}
    WriteINIStr "$PLUGINSDIR\summary.ini" "Field 3" Text "$(SUMMARY_INSTALL_CLICK)"
    DeleteINIStr "$PLUGINSDIR\summary.ini" "Settings" NextButtonText
  ${EndIf}


  ; Remove the "Field 4" ini section in case the user hits back and changes the
  ; installation directory which could change whether the make default checkbox
  ; should be displayed.
  DeleteINISec "$PLUGINSDIR\summary.ini" "Field 4"

  ; Check if it is possible to write to HKLM
  ClearErrors
  WriteRegStr HKLM "Software\Zotero" "${BrandShortName}InstallerTest" "Write Test"
  ${Unless} ${Errors}
    DeleteRegValue HKLM "Software\Zotero" "${BrandShortName}InstallerTest"
    ; Check if Firefox is the http handler for this user.
    SetShellVarContext current ; Set SHCTX to the current user
    ${IsHandlerForInstallDir} "http" $R9
    ${If} $TmpVal == "HKLM"
      SetShellVarContext all ; Set SHCTX to all users
    ${EndIf}
  ${EndUnless}

  ${If} "$TmpVal" == "true"
    ; If there is already a Type entry in the "Field 4" section with a value of
    ; checkbox then the set as the default browser checkbox is displayed and
    ; this text must be moved below it.
    ReadINIStr $0 "$PLUGINSDIR\summary.ini" "Field 4" "Type"
    ${If} "$0" == "checkbox"
      StrCpy $0 "5"
      WriteINIStr "$PLUGINSDIR\summary.ini" "Field $0" Top    "53"
      WriteINIStr "$PLUGINSDIR\summary.ini" "Field $0" Bottom "68"
    ${Else}
      StrCpy $0 "4"
      WriteINIStr "$PLUGINSDIR\summary.ini" "Field $0" Top    "35"
      WriteINIStr "$PLUGINSDIR\summary.ini" "Field $0" Bottom "50"
    ${EndIf}
    WriteINIStr "$PLUGINSDIR\summary.ini" "Settings" NumFields "$0"

    WriteINIStr "$PLUGINSDIR\summary.ini" "Field $0" Type   "label"
    WriteINIStr "$PLUGINSDIR\summary.ini" "Field $0" Text   "$(SUMMARY_REBOOT_REQUIRED_INSTALL)"
    WriteINIStr "$PLUGINSDIR\summary.ini" "Field $0" Left   "0"
    WriteINIStr "$PLUGINSDIR\summary.ini" "Field $0" Right  "-1"
  ${EndIf}

  !insertmacro MUI_HEADER_TEXT "$(SUMMARY_PAGE_TITLE)" "$(SUMMARY_PAGE_SUBTITLE)"

  ; The Summary custom page has a textbox that will automatically receive
  ; focus. This sets the focus to the Install button instead.
  !insertmacro MUI_INSTALLOPTIONS_INITDIALOG "summary.ini"
  GetDlgItem $0 $HWNDPARENT 1
  System::Call "user32::SetFocus(i r0, i 0x0007, i,i)i"
  ${MUI_INSTALLOPTIONS_READ} $1 "summary.ini" "Field 2" "HWND"
  SendMessage $1 ${WM_SETTEXT} 0 "STR:$INSTDIR"
  !insertmacro MUI_INSTALLOPTIONS_SHOW
FunctionEnd

; When we add an optional action to the finish page the cancel button is
; enabled. This disables it and leaves the finish button as the only choice.
Function preFinish
  StrCpy $PageName ""
  ${EndInstallLog} "${BrandFullName}"
  !insertmacro MUI_INSTALLOPTIONS_WRITE "ioSpecial.ini" "settings" "cancelenabled" "0"
FunctionEnd

################################################################################
# Initialization Functions

Function .onInit
  StrCpy $PageName ""
  StrCpy $LANGUAGE 0

  ; Starting user preferences need to be defined in code so that silent
  ; installations will work correctly. These can later be modified in the .ini
  ; file and command-line argument handlers.
  StrCpy $AddDesktopSC "${DESKTOP_SHORTCUT_DEFAULT}"
  StrCpy $AddStartMenuSC "${START_MENU_SHORTCUT_DEFAULT}"
  StrCpy $AddQuickLaunchSC "${QUICKLAUNCH_SHORTCUT_DEFAULT}"
  StrCpy $InstallType ${INSTALLTYPE_DEFAULT}

  ${SetBrandNameVars} "$EXEDIR\core\distribution\setup.ini"

  ${InstallOnInitCommon} "$(WARN_MIN_SUPPORTED_OS_MSG)"

  !ifdef HAVE_64BIT_BUILD
    ${If} "${ARCH}" == "AArch64"
      ${IfNot} ${IsNativeARM64}
        MessageBox MB_OK|MB_ICONSTOP "$(WARN_MIN_SUPPORTED_OS_MSG)" IDOK
        ; Nothing initialized so no need to call OnEndCommon
        Quit
      ${EndIf}
    ${ElseIfNot} ${RunningX64}
      MessageBox MB_OK|MB_ICONSTOP "$(WARN_MIN_SUPPORTED_OS_MSG)" IDOK
      ; Nothing initialized so no need to call OnEndCommon
      Quit
    ${EndIf}
  !endif

  StrCpy $R1 "Zotero Standalone"
  StrCpy $R2 "An older version of Zotero is installed. If you continue, the existing version will be removed.$\n$\nYour Zotero data will not be affected."
  Call UninstallOld

  !ifdef HAVE_64BIT_BUILD
    SetRegView 32
      StrCpy $R1 "Zotero"
      StrCpy $R2 "A 32-bit version of Zotero is installed. If you continue, it will be replaced with a 64-bit version that offers better performance.$\n$\nYour Zotero data will not be affected."
      Call UninstallOld
    SetRegView 64
  !endif

  !ifdef HAVE_64BIT_BUILD
    ${If} "${ARCH}" == "x64"
      ${If} ${IsNativeARM64}
        MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
          "This installer is for the x64 version of Zotero, but you appear to be running an ARM version of Windows.$\n$\nFor the best performance, please cancel and download the ARM version of Zotero for Windows." \
          /SD IDOK IDOK continue_architecture IDCANCEL cancel_architecture
          cancel_architecture:
            Abort
          continue_architecture:
      ${EndIf}
    ${EndIf}
  !endif

  !ifndef HAVE_64BIT_BUILD
    ${If} ${RunningX64}
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION|MB_DEFBUTTON2 \
        "This installer is for the 32-bit version of Zotero, but you appear to be running a 64-bit version of Windows.$\n$\nFor the best performance, please cancel and download the 64-bit version of Zotero." \
        /SD IDOK IDOK continue_architecture IDCANCEL cancel_architecture
        cancel_architecture:
          Abort
        continue_architecture:
    ${EndIf}
  !endif

  !insertmacro InitInstallOptionsFile "options.ini"
  !insertmacro InitInstallOptionsFile "shortcuts.ini"
  !insertmacro InitInstallOptionsFile "summary.ini"

  WriteINIStr "$PLUGINSDIR\options.ini" "Settings" NumFields "5"

  WriteINIStr "$PLUGINSDIR\options.ini" "Field 1" Type   "label"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 1" Text   "$(OPTIONS_SUMMARY)"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 1" Left   "0"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 1" Right  "-1"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 1" Top    "0"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 1" Bottom "10"

  WriteINIStr "$PLUGINSDIR\options.ini" "Field 2" Type   "RadioButton"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 2" Text   "$(OPTION_STANDARD_RADIO)"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 2" Left   "0"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 2" Right  "-1"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 2" Top    "25"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 2" Bottom "35"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 2" State  "1"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 2" Flags  "GROUP"

  WriteINIStr "$PLUGINSDIR\options.ini" "Field 3" Type   "RadioButton"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 3" Text   "$(OPTION_CUSTOM_RADIO)"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 3" Left   "0"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 3" Right  "-1"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 3" Top    "55"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 3" Bottom "65"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 3" State  "0"

  WriteINIStr "$PLUGINSDIR\options.ini" "Field 4" Type   "label"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 4" Text   "$(OPTION_STANDARD_DESC)"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 4" Left   "15"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 4" Right  "-1"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 4" Top    "37"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 4" Bottom "57"

  WriteINIStr "$PLUGINSDIR\options.ini" "Field 5" Type   "label"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 5" Text   "$(OPTION_CUSTOM_DESC)"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 5" Left   "15"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 5" Right  "-1"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 5" Top    "67"
  WriteINIStr "$PLUGINSDIR\options.ini" "Field 5" Bottom "87"

  ; Setup the shortcuts.ini file for the Custom Shortcuts Page
  ; Don't offer to install the quick launch shortcut on Windows 7
  ${If} ${AtLeastWin7}
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Settings" NumFields "3"
  ${Else}
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Settings" NumFields "4"
  ${EndIf}

  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 1" Type   "label"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 1" Text   "$(CREATE_ICONS_DESC)"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 1" Left   "0"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 1" Right  "-1"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 1" Top    "5"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 1" Bottom "15"

  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 2" Type   "checkbox"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 2" Text   "$(ICONS_DESKTOP)"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 2" Left   "0"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 2" Right  "-1"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 2" Top    "20"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 2" Bottom "30"

  ; Default UI selection synchronized with existing value.
  Push $0
  StrCpy $0 "${DESKTOP_SHORTCUT_DISABLED}"
  IntCmp $AddDesktopSC ${DESKTOP_SHORTCUT_ENABLED} +1 +2 +2
  StrCpy $0 "${DESKTOP_SHORTCUT_ENABLED}"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 2" State  $0
  Pop $0

  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 2" Flags  "GROUP"

  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 3" Type   "checkbox"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 3" Text   "$(ICONS_STARTMENU)"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 3" Left   "0"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 3" Right  "-1"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 3" Top    "40"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 3" Bottom "50"

  ; Default UI selection synchronized with existing value.
  Push $0
  StrCpy $0 "${START_MENU_SHORTCUT_DISABLED}"
  IntCmp $AddStartMenuSC ${START_MENU_SHORTCUT_ENABLED} +1 +2 +2
  StrCpy $0 "${START_MENU_SHORTCUT_ENABLED}"
  WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 3" State $0
  Pop $0

  ; Don't offer to install the quick launch shortcut on Windows 7
  ${Unless} ${AtLeastWin7}
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 4" Type   "checkbox"
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 4" Text   "$(ICONS_QUICKLAUNCH)"
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 4" Left   "0"
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 4" Right  "-1"
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 4" Top    "60"
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 4" Bottom "70"

    Push $0
    StrCpy $0 "0"
    IntCmp $AddQuickLaunchSC ${QUICKLAUNCH_SHORTCUT_ENABLED} +1 +2 +2
    StrCpy $0 "1"
    WriteINIStr "$PLUGINSDIR\shortcuts.ini" "Field 4" State $0
    Pop $0
  ${EndUnless}

  ; There must always be a core directory.
  ${GetSize} "$EXEDIR\core\" "/S=0K" $R5 $R7 $R8
  SectionSetSize ${APP_IDX} $R5

  ; Initialize $hHeaderBitmap to prevent redundant changing of the bitmap if
  ; the user clicks the back button
  StrCpy $hHeaderBitmap ""
FunctionEnd

Function .onGUIEnd
  ${OnEndCommon}
FunctionEnd

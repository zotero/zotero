# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

################################################################################
# Modified versions of macros provided by NSIS

!ifndef OVERRIDES_INCLUDED
!define OVERRIDES_INCLUDED

; When including a file check if its verbose macro is defined to prevent
; loading the file a second time.
!ifmacrondef TEXTFUNC_VERBOSE
!include TextFunc.nsh
!endif

!ifmacrondef FILEFUNC_VERBOSE
!include FileFunc.nsh
!endif

!macro __MOZ__WinVer_DefineOSTests WinVer
  !insertmacro __WinVer_DefineOSTest AtLeast ${WinVer} ""
  !insertmacro __WinVer_DefineOSTest AtMost ${WinVer} ""
  !insertmacro __WinVer_DefineOSTest Is ${WinVer} ""
!macroend

!ifndef WINVER_7
  !define WINVER_7    0x06010000 ;6.01.????
  !insertmacro __MOZ__WinVer_DefineOSTests 7
!endif
 
!ifndef WINVER_2008R2
  !define WINVER_2008R2    0x06010001 ;6.01.????
  !insertmacro __MOZ__WinVer_DefineOSTests 2008R2
!endif

!ifndef WINVER_8
  !define WINVER_8    0x06020000 ;6.02.????
  !insertmacro __MOZ__WinVer_DefineOSTests 8
!endif

!verbose push
!verbose 3
!ifndef _OVERRIDE_VERBOSE
  !define _OVERRIDE_VERBOSE 3
!endif
!verbose ${_OVERRIDE_VERBOSE}
!define OVERRIDE_VERBOSE `!insertmacro OVERRIDE_VERBOSE`
!define _OVERRIDE_UN
!define _OVERRIDE_S
!verbose pop

!macro OVERRIDE_VERBOSE _VERBOSE
  !verbose push
  !verbose 3
  !undef _OVERRIDE_VERBOSE
  !define _OVERRIDE_VERBOSE ${_VERBOSE}
  !verbose pop
!macroend

; Modified version of Locate from the NSIS File Functions Header v3.4 (it has 
; the same version in earlier versions of NSIS even though it has changed) that
; is distributed with NSIS v2.46-Unicode. This version has the calls to
; SetDetailsPrint commented out.
; See <NSIS v2.46-Unicode App Dir>/include/FileFunc.nsh for more information.
!macro LocateNoDetailsCall _PATH _OPTIONS _FUNC
  !verbose push
  !verbose ${_OVERRIDE_VERBOSE}
  Push $0
  Push `${_PATH}`
  Push `${_OPTIONS}`
  GetFunctionAddress $0 `${_FUNC}`
  Push `$0`
  Call LocateNoDetails
  Pop $0
  !verbose pop
!macroend

!macro LocateNoDetails
  !ifndef ${_OVERRIDE_UN}LocateNoDetails
    !verbose push
    !verbose ${_OVERRIDE_VERBOSE}
    !define ${_OVERRIDE_UN}LocateNoDetails `!insertmacro ${_OVERRIDE_UN}LocateNoDetailsCall`

    Function ${_OVERRIDE_UN}LocateNoDetails
      Exch $2
      Exch
      Exch $1
      Exch
      Exch 2
      Exch $0
      Exch 2
      Push $3
      Push $4
      Push $5
      Push $6
      Push $7
      Push $8
      Push $9
      Push $R6
      Push $R7
      Push $R8
      Push $R9
      ClearErrors

      StrCpy $3 ''
      StrCpy $4 ''
      StrCpy $5 ''
      StrCpy $6 ''
      StrCpy $7 ''
      StrCpy $8 0
      StrCpy $R7 ''

      StrCpy $R9 $0 1 -1
      StrCmp $R9 '\' 0 +3
      StrCpy $0 $0 -1
      goto -3
      IfFileExists '$0\*.*' 0 error

      option:
      StrCpy $R9 $1 1
      StrCpy $1 $1 '' 1
      StrCmp $R9 ' ' -2
      StrCmp $R9 '' sizeset
      StrCmp $R9 '/' 0 -4
      StrCpy $9 -1
      IntOp $9 $9 + 1
      StrCpy $R9 $1 1 $9
      StrCmp $R9 '' +2
      StrCmp $R9 '/' 0 -3
      StrCpy $R8 $1 $9
      StrCpy $R8 $R8 '' 2
      StrCpy $R9 $R8 '' -1
      StrCmp $R9 ' ' 0 +3
      StrCpy $R8 $R8 -1
      goto -3
      StrCpy $R9 $1 2
      StrCpy $1 $1 '' $9

      StrCmp $R9 'L=' 0 mask
      StrCpy $3 $R8
      StrCmp $3 '' +6
      StrCmp $3 'FD' +5
      StrCmp $3 'F' +4
      StrCmp $3 'D' +3
      StrCmp $3 'DE' +2
      StrCmp $3 'FDE' 0 error
      goto option

      mask:
      StrCmp $R9 'M=' 0 size
      StrCpy $4 $R8
      goto option

      size:
      StrCmp $R9 'S=' 0 gotosubdir
      StrCpy $6 $R8
      goto option

      gotosubdir:
      StrCmp $R9 'G=' 0 banner
      StrCpy $7 $R8
      StrCmp $7 '' +3
      StrCmp $7 '1' +2
      StrCmp $7 '0' 0 error
      goto option

      banner:
      StrCmp $R9 'B=' 0 error
      StrCpy $R7 $R8
      StrCmp $R7 '' +3
      StrCmp $R7 '1' +2
      StrCmp $R7 '0' 0 error
      goto option

      sizeset:
      StrCmp $6 '' default
      StrCpy $9 0
      StrCpy $R9 $6 1 $9
      StrCmp $R9 '' +4
      StrCmp $R9 ':' +3
      IntOp $9 $9 + 1
      goto -4
      StrCpy $5 $6 $9
      IntOp $9 $9 + 1
      StrCpy $1 $6 1 -1
      StrCpy $6 $6 -1 $9
      StrCmp $5 '' +2
      IntOp $5 $5 + 0
      StrCmp $6 '' +2
      IntOp $6 $6 + 0

      StrCmp $1 'B' 0 +3
      StrCpy $1 1
      goto default
      StrCmp $1 'K' 0 +3
      StrCpy $1 1024
      goto default
      StrCmp $1 'M' 0 +3
      StrCpy $1 1048576
      goto default
      StrCmp $1 'G' 0 error
      StrCpy $1 1073741824

      default:
      StrCmp $3 '' 0 +2
      StrCpy $3 'FD'
      StrCmp $4 '' 0 +2
      StrCpy $4 '*.*'
      StrCmp $7 '' 0 +2
      StrCpy $7 '1'
      StrCmp $R7 '' 0 +2
      StrCpy $R7 '0'
      StrCpy $7 'G$7B$R7'

      StrCpy $8 1
      Push $0
;      SetDetailsPrint textonly

      nextdir:
      IntOp $8 $8 - 1
      Pop $R8

      StrCpy $9 $7 2 2
      StrCmp $9 'B0' +3
      GetLabelAddress $9 findfirst
      goto call
;      DetailPrint 'Search in: $R8'

      findfirst:
      FindFirst $0 $R7 '$R8\$4'
      IfErrors subdir
      StrCmp $R7 '.' 0 dir
      FindNext $0 $R7
      StrCmp $R7 '..' 0 dir
      FindNext $0 $R7
      IfErrors 0 dir
      FindClose $0
      goto subdir

      dir:
      IfFileExists '$R8\$R7\*.*' 0 file
      StrCpy $R6 ''
      StrCmp $3 'DE' +4
      StrCmp $3 'FDE' +3
      StrCmp $3 'FD' precall
      StrCmp $3 'F' findnext precall
      FindFirst $9 $R9 '$R8\$R7\*.*'
      StrCmp $R9 '.' 0 +4
      FindNext $9 $R9
      StrCmp $R9 '..' 0 +2
      FindNext $9 $R9
      FindClose $9
      IfErrors precall findnext

      file:
      StrCmp $3 'FDE' +3
      StrCmp $3 'FD' +2
      StrCmp $3 'F' 0 findnext
      StrCpy $R6 0
      StrCmp $5$6 '' precall
      FileOpen $9 '$R8\$R7' r
      IfErrors +3
      FileSeek $9 0 END $R6
      FileClose $9
      System::Int64Op $R6 / $1
      Pop $R6
      StrCmp $5 '' +2
      IntCmp $R6 $5 0 findnext
      StrCmp $6 '' +2
      IntCmp $R6 $6 0 0 findnext

      precall:
      StrCpy $9 0
      StrCpy $R9 '$R8\$R7'

      call:
      Push $0
      Push $1
      Push $2
      Push $3
      Push $4
      Push $5
      Push $6
      Push $7
      Push $8
      Push $9
      Push $R7
      Push $R8
      StrCmp $9 0 +4
      StrCpy $R6 ''
      StrCpy $R7 ''
      StrCpy $R9 ''
      Call $2
      Pop $R9
      Pop $R8
      Pop $R7
      Pop $9
      Pop $8
      Pop $7
      Pop $6
      Pop $5
      Pop $4
      Pop $3
      Pop $2
      Pop $1
      Pop $0

      IfErrors 0 +3
      FindClose $0
      goto error
      StrCmp $R9 'StopLocateNoDetails' 0 +3
      FindClose $0
      goto clearstack
      goto $9

      findnext:
      FindNext $0 $R7
      IfErrors 0 dir
      FindClose $0

      subdir:
      StrCpy $9 $7 2
      StrCmp $9 'G0' end
      FindFirst $0 $R7 '$R8\*.*'
      StrCmp $R7 '.' 0 pushdir
      FindNext $0 $R7
      StrCmp $R7 '..' 0 pushdir
      FindNext $0 $R7
      IfErrors 0 pushdir
      FindClose $0
      StrCmp $8 0 end nextdir

      pushdir:
      IfFileExists '$R8\$R7\*.*' 0 +3
      Push '$R8\$R7'
      IntOp $8 $8 + 1
      FindNext $0 $R7
      IfErrors 0 pushdir
      FindClose $0
      StrCmp $8 0 end nextdir

      error:
      SetErrors

      clearstack:
      StrCmp $8 0 end
      IntOp $8 $8 - 1
      Pop $R8
      goto clearstack

      end:
;      SetDetailsPrint both
      Pop $R9
      Pop $R8
      Pop $R7
      Pop $R6
      Pop $9
      Pop $8
      Pop $7
      Pop $6
      Pop $5
      Pop $4
      Pop $3
      Pop $2
      Pop $1
      Pop $0
    FunctionEnd

    !verbose pop
  !endif
!macroend

!macro un.LocateNoDetailsCall _PATH _OPTIONS _FUNC
  !verbose push
  !verbose ${_OVERRIDE_VERBOSE}
  Push $0
  Push `${_PATH}`
  Push `${_OPTIONS}`
  GetFunctionAddress $0 `${_FUNC}`
  Push `$0`
  Call un.LocateNoDetails
  Pop $0
  !verbose pop
!macroend

!macro un.LocateNoDetails
  !ifndef un.LocateNoDetails
    !verbose push
    !verbose ${_OVERRIDE_VERBOSE}
    !undef _OVERRIDE_UN
    !define _OVERRIDE_UN `un.`

    !insertmacro LocateNoDetails

    !undef _OVERRIDE_UN
    !define _OVERRIDE_UN
    !verbose pop
  !endif
!macroend

; Modified version of TextCompare from the NSIS Text Functions Header v2.4 (it
; has the same version in earlier versions of NSIS even though it has changed)
; that is distributed with NSIS v2.46-Unicode. This version has the calls to
; SetDetailsPrint commented out.
; See <NSIS v2.46-Unicode App Dir>/include/TextFunc.nsh for more information.

!macro TextCompareNoDetailsCall _FILE1 _FILE2 _OPTION _FUNC
  !verbose push
  !verbose ${_OVERRIDE_VERBOSE}
  Push $0
  Push `${_FILE1}`
  Push `${_FILE2}`
  Push `${_OPTION}`
  GetFunctionAddress $0 `${_FUNC}`
  Push `$0`
  ${CallArtificialFunction} TextCompareNoDetails_
  Pop $0
  !verbose pop
!macroend

!macro TextCompareNoDetailsSCall _FILE1 _FILE2 _OPTION _FUNC
  !verbose push
  !verbose ${_OVERRIDE_VERBOSE}
  Push $0
  Push `${_FILE1}`
  Push `${_FILE2}`
  Push `${_OPTION}`
  GetFunctionAddress $0 `${_FUNC}`
  Push `$0`
  ${CallArtificialFunction} TextCompareNoDetailsS_
  Pop $0
  !verbose pop
!macroend


!macro TextCompareNoDetailsBody _OVERRIDE_S
  Exch $3
  Exch
  Exch $2
  Exch
  Exch 2
  Exch $1
  Exch 2
  Exch 3
  Exch $0
  Exch 3
  Push $4
  Push $5
  Push $6
  Push $7
  Push $8
  Push $9
  ClearErrors

  IfFileExists $0 0 TextFunc_TextCompareNoDetails${_OVERRIDE_S}_error
  IfFileExists $1 0 TextFunc_TextCompareNoDetails${_OVERRIDE_S}_error
  StrCmp $2 'FastDiff' +5
  StrCmp $2 'FastEqual' +4
  StrCmp $2 'SlowDiff' +3
  StrCmp $2 'SlowEqual' +2
  goto TextFunc_TextCompareNoDetails${_OVERRIDE_S}_error

  FileOpen $4 $0 r
  IfErrors TextFunc_TextCompareNoDetails${_OVERRIDE_S}_error
  FileOpen $5 $1 r
  IfErrors TextFunc_TextCompareNoDetails${_OVERRIDE_S}_error
;  SetDetailsPrint textonly

  StrCpy $6 0
  StrCpy $8 0

  TextFunc_TextCompareNoDetails${_OVERRIDE_S}_nextline:
  StrCmp${_OVERRIDE_S} $4 '' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_fast
  IntOp $8 $8 + 1
  FileRead $4 $9
  IfErrors 0 +4
  FileClose $4
  StrCpy $4 ''
  StrCmp${_OVERRIDE_S} $5 '' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_end
  StrCmp $2 'FastDiff' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_fast
  StrCmp $2 'FastEqual' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_fast TextFunc_TextCompareNoDetails${_OVERRIDE_S}_slow

  TextFunc_TextCompareNoDetails${_OVERRIDE_S}_fast:
  StrCmp${_OVERRIDE_S} $5 '' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_call
  IntOp $6 $6 + 1
  FileRead $5 $7
  IfErrors 0 +5
  FileClose $5
  StrCpy $5 ''
  StrCmp${_OVERRIDE_S} $4 '' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_end
  StrCmp $2 'FastDiff' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_call TextFunc_TextCompareNoDetails${_OVERRIDE_S}_close
  StrCmp $2 'FastDiff' 0 +2
  StrCmp${_OVERRIDE_S} $7 $9 TextFunc_TextCompareNoDetails${_OVERRIDE_S}_nextline TextFunc_TextCompareNoDetails${_OVERRIDE_S}_call
  StrCmp${_OVERRIDE_S} $7 $9 TextFunc_TextCompareNoDetails${_OVERRIDE_S}_call TextFunc_TextCompareNoDetails${_OVERRIDE_S}_nextline

  TextFunc_TextCompareNoDetails${_OVERRIDE_S}_slow:
  StrCmp${_OVERRIDE_S} $4 '' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_close
  StrCpy $6 ''
;  DetailPrint '$8. $9'
  FileSeek $5 0

  TextFunc_TextCompareNoDetails${_OVERRIDE_S}_slownext:
  FileRead $5 $7
  IfErrors 0 +2
  StrCmp $2 'SlowDiff' TextFunc_TextCompareNoDetails${_OVERRIDE_S}_call TextFunc_TextCompareNoDetails${_OVERRIDE_S}_nextline
  StrCmp $2 'SlowDiff' 0 +2
  StrCmp${_OVERRIDE_S} $7 $9 TextFunc_TextCompareNoDetails${_OVERRIDE_S}_nextline TextFunc_TextCompareNoDetails${_OVERRIDE_S}_slownext
  IntOp $6 $6 + 1
  StrCmp${_OVERRIDE_S} $7 $9 0 TextFunc_TextCompareNoDetails${_OVERRIDE_S}_slownext

  TextFunc_TextCompareNoDetails${_OVERRIDE_S}_call:
  Push $2
  Push $3
  Push $4
  Push $5
  Push $6
  Push $7
  Push $8
  Push $9
  Call $3
  Pop $0
  Pop $9
  Pop $8
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  StrCmp $0 'StopTextCompareNoDetails' 0 TextFunc_TextCompareNoDetails${_OVERRIDE_S}_nextline

  TextFunc_TextCompareNoDetails${_OVERRIDE_S}_close:
  FileClose $4
  FileClose $5
  goto TextFunc_TextCompareNoDetails${_OVERRIDE_S}_end

  TextFunc_TextCompareNoDetails${_OVERRIDE_S}_error:
  SetErrors

  TextFunc_TextCompareNoDetails${_OVERRIDE_S}_end:
;  SetDetailsPrint both
  Pop $9
  Pop $8
  Pop $7
  Pop $6
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Pop $0
!macroend

!define TextCompareNoDetails `!insertmacro TextCompareNoDetailsCall`
!define un.TextCompareNoDetails `!insertmacro TextCompareNoDetailsCall`

!macro TextCompareNoDetails
!macroend

!macro un.TextCompareNoDetails
!macroend

!macro TextCompareNoDetails_
  !verbose push
  !verbose ${_OVERRIDE_VERBOSE}

  !insertmacro TextCompareNoDetailsBody ''

  !verbose pop
!macroend

!define TextCompareNoDetailsS `!insertmacro TextCompareNoDetailsSCall`
!define un.TextCompareNoDetailsS `!insertmacro TextCompareNoDetailsSCall`

!macro TextCompareNoDetailsS
!macroend

!macro un.TextCompareNoDetailsS
!macroend

!macro TextCompareNoDetailsS_
  !verbose push
  !verbose ${_OVERRIDE_VERBOSE}

  !insertmacro TextCompareNoDetailsBody 'S'

  !verbose pop
!macroend

!endif

Option Explicit

Dim WshShell
Dim fso
Dim exe, src, dest

Set WshShell = Wscript.CreateObject("Wscript.Shell")
Set fso = WScript.CreateObject("Scripting.FileSystemObject")

If Not(Wscript.Arguments.Count = 3) Then
  Wscript.Echo "Usage: redirect.vbs <.exe file> <source file> <text file>"
  WScript.Quit 1
End If

exe = WScript.Arguments(0)
src = WScript.Arguments(1)
dest = WScript.Arguments(2)
If Not(fso.FileExists(exe)) Then
  WScript.Echo "Executable not found: " & exe
  WScript.Quit 1
End If

If Not(fso.FileExists(src)) Then
  WScript.Echo "Source file not found: " & src
  WScript.Quit 1
End If

If Not(fso.FolderExists(Left(dest, InstrRev(dest, "\")))) Then
  WScript.Echo "Destination folder not found: " & Left(dest, InstrRev(dest, "\"))
  WScript.Quit 1
End If

WshShell.Run "%comspec% /c " & exe & " " & chr(34) & src & chr(34) & " > " & chr(34) & dest & chr(34), 0, true

Option Explicit

Dim WshShell, fso, exe, args, I

Set WshShell = Wscript.CreateObject("Wscript.Shell")
Set fso = WScript.CreateObject("Scripting.FileSystemObject")

If WScript.Arguments.Count = 0 Then
  WScript.Echo "Usage: hidden.vbs program.exe [args...]"
  WScript.Quit 1
End If

exe = WScript.Arguments(0)
If Not(fso.FileExists(exe)) Then
  WScript.Echo "Executable not found: " & exe
  WScript.Quit 1
End If

args = ""
For I = 1 to WScript.Arguments.Count - 1
  args = args & " " & chr(34) & WScript.Arguments(I) & chr(34)
Next

WshShell.Run exe & args, 0, true

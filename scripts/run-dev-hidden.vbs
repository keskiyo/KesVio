Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
quote = Chr(34)


candidates = Array( _
  root & "\src-tauri\target\release\KesVio.exe", _
  root & "\.cargo-target\release\KesVio.exe", _
  root & "\src-tauri\target\release\app.exe", _
  root & "\.cargo-target\release\app.exe")
exe = ""
For Each candidate In candidates
  If fso.FileExists(candidate) Then
    If exe = "" Then
      exe = candidate
    ElseIf fso.GetFile(candidate).DateLastModified > fso.GetFile(exe).DateLastModified Then
      exe = candidate
    End If
  End If
Next
If exe <> "" Then
  shell.Run quote & exe & quote, 1, False
Else
  MsgBox "KesVio is not built yet.", 48, "KesVio"
End If

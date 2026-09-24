!macro NSIS_HOOK_POSTINSTALL
  ; Register autostart for the current user during installation.
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Lexicon" '"$INSTDIR\lexicon.exe" --autostart'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Remove autostart registration and startup tracking on uninstall.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Lexicon"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run" "Lexicon"
!macroend

@echo off
rem Launcher wrapper for new-restaurant.ps1.
rem
rem Like start-app.cmd, this bypasses the .ps1 execution policy for this one
rem invocation only -- it changes no machine or user setting.
rem
rem Usage (start-app.cmd must be running in another window):
rem   new-restaurant.cmd <slug> "<name>" <owner-email>
rem   new-restaurant.cmd <slug> "<name>" <owner-email> -OwnerName "<name>" -Domain <domain>

setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0new-restaurant.ps1" %*
exit /b %ERRORLEVEL%

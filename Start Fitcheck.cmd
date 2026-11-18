@echo off
cd /d "%~dp0"
node start-fitcheck.mjs
if errorlevel 1 pause

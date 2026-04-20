@echo off
chcp 65001 >nul
title Axhost-Make Serve
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "start.ps1"

# Axhost-Make Serve Launcher (PowerShell)
# Double-click start.cmd to run this script

$workspaceRoot = $PSScriptRoot
Set-Location $workspaceRoot

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[Error] Node.js not found. Please install Node.js >= 22." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

$port = 3820
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Axhost-Make Serve" -ForegroundColor Cyan
Write-Host "  Workspace: $workspaceRoot" -ForegroundColor Cyan
Write-Host "  Port:      $port" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting server... (close this window to stop)" -ForegroundColor Green
Write-Host ""

& node axhost-make/bin/axhost-make.js serve --port $port

Write-Host ""
Write-Host "Server stopped." -ForegroundColor Yellow
Write-Host ""
Read-Host "Press Enter to exit"

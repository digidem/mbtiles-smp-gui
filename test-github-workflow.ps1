# Script to test GitHub Actions workflow locally on Windows

# Exit on error
$ErrorActionPreference = "Stop"

Write-Host "=== Testing GitHub Actions workflow locally ===" -ForegroundColor Green
Write-Host "This script simulates the GitHub Actions workflow steps" -ForegroundColor Green

# Check Node.js and npm versions
Write-Host "`n=== Checking Node.js and npm versions ===" -ForegroundColor Green
node --version
npm --version

# Check system information
Write-Host "`n=== System information ===" -ForegroundColor Green
systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Type"

# Install dependencies
Write-Host "`n=== Installing dependencies ===" -ForegroundColor Green
npm install --legacy-peer-deps

# Check for native dependencies in the root package.json
Write-Host "`n=== Checking for native dependencies ===" -ForegroundColor Green
$nativeDeps = Get-ChildItem -Path node_modules -Depth 1 -Filter "binding.gyp" -Recurse | ForEach-Object { $_.Directory.Name }
if ($nativeDeps) {
    Write-Host "Warning: Found native dependencies in root package.json: $nativeDeps" -ForegroundColor Yellow
    Write-Host "These should be moved to release/app/package.json" -ForegroundColor Yellow
}

# Install dependencies in release/app
Write-Host "`n=== Installing dependencies in release/app ===" -ForegroundColor Green
Push-Location -Path "release/app"
npm install --ignore-scripts

# Rebuild native modules for Windows
Write-Host "`n=== Rebuilding native modules ===" -ForegroundColor Green

# Rebuild better-sqlite3 for Electron
npx electron-rebuild -f -w better-sqlite3 -v 26.6.10

# Check the installed packages
npm list better-sqlite3

# Check the binary module
Write-Host "`n=== Checking binary modules ===" -ForegroundColor Green
if (Test-Path -Path "node_modules\better-sqlite3\build\Release") {
    Get-ChildItem -Path "node_modules\better-sqlite3\build\Release" -Filter "*.node"
} else {
    Write-Host "No .node files found" -ForegroundColor Yellow
}

Pop-Location

# Run tests
Write-Host "`n=== Running tests ===" -ForegroundColor Green
npm test

# Test packaging for Windows
Write-Host "`n=== Testing packaging for Windows ===" -ForegroundColor Green
npm run package:win -- --dir

Write-Host "`n=== Workflow test completed ===" -ForegroundColor Green

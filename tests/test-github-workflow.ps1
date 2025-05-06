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

# Check for Visual Studio Build Tools
Write-Host "`n=== Checking for Visual Studio Build Tools ===" -ForegroundColor Green
$vsPath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio"
if (Test-Path -Path $vsPath) {
    Write-Host "Visual Studio installation found at: $vsPath" -ForegroundColor Green
    Get-ChildItem -Path $vsPath -Directory | ForEach-Object { Write-Host "- $_" }
} else {
    Write-Host "Visual Studio not found. You may need to install Visual Studio Build Tools." -ForegroundColor Yellow
    Write-Host "Download from: https://visualstudio.microsoft.com/visual-cpp-build-tools/" -ForegroundColor Yellow
}

# Install node-gyp globally
Write-Host "`n=== Installing node-gyp globally ===" -ForegroundColor Green
npm install -g node-gyp

# Configure node-gyp to use Python
Write-Host "`n=== Configuring node-gyp to use Python ===" -ForegroundColor Green
$pythonPath = (Get-Command python).Path
Write-Host "Python path: $pythonPath" -ForegroundColor Green

# Create or update .npmrc file with Python path and MSVS version
Write-Host "`n=== Configuring .npmrc file ===" -ForegroundColor Green
echo "python=$pythonPath" | Out-File -Append -Encoding utf8 $env:USERPROFILE\.npmrc
echo "msvs_version=2019" | Out-File -Append -Encoding utf8 $env:USERPROFILE\.npmrc

# Show the .npmrc file
Write-Host "`n=== Contents of .npmrc ===" -ForegroundColor Green
Get-Content $env:USERPROFILE\.npmrc

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
    Write-Host "No .node files found in build\Release" -ForegroundColor Yellow
    # Check other possible locations
    Write-Host "Searching for .node files in better-sqlite3 directory:" -ForegroundColor Yellow
    Get-ChildItem -Path "node_modules\better-sqlite3" -Recurse -Filter "*.node" | Select-Object FullName
}

Pop-Location

# Run tests
Write-Host "`n=== Running tests ===" -ForegroundColor Green
# Make sure we're using cross-env for NODE_OPTIONS to support all platforms
$packageJson = Get-Content package.json -Raw
if ($packageJson -notmatch "cross-env NODE_OPTIONS") {
    Write-Host "Warning: The test script in package.json should use cross-env for NODE_OPTIONS" -ForegroundColor Yellow
    Write-Host "Current test script:" -ForegroundColor Yellow
    Select-String -Path package.json -Pattern '"test":'
    Write-Host "Recommended: `"test`": `"cross-env NODE_OPTIONS=--experimental-vm-modules jest -c jest.config.js`"," -ForegroundColor Green
}
npm test

# Test packaging for Windows
Write-Host "`n=== Testing packaging for Windows ===" -ForegroundColor Green
npm run package:win -- --dir

Write-Host "`n=== Workflow test completed ===" -ForegroundColor Green

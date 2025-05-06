#!/bin/bash
# Script to test GitHub Actions workflow locally

set -e  # Exit on error

echo "=== Testing GitHub Actions workflow locally ==="
echo "This script simulates the GitHub Actions workflow steps"

# Detect platform
PLATFORM="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
  PLATFORM="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
  PLATFORM="macos"
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
  PLATFORM="windows"
fi

echo "Detected platform: $PLATFORM"

# Check Node.js and npm versions
echo "=== Checking Node.js and npm versions ==="
node --version
npm --version

# Check system information
echo "=== System information ==="
if [[ "$PLATFORM" == "linux" || "$PLATFORM" == "macos" ]]; then
  uname -a
  arch
elif [[ "$PLATFORM" == "windows" ]]; then
  systeminfo | findstr /B /C:"OS Name" /C:"OS Version" /C:"System Type" || echo "Could not get system info"
fi

# Install node-gyp globally
echo "=== Installing node-gyp globally ==="
npm install -g node-gyp

# Configure node-gyp to use Python
echo "=== Configuring node-gyp to use Python ==="
PYTHON_PATH=$(python -c "import sys; print(sys.executable)")
echo "Python path: $PYTHON_PATH"

# Create or update .npmrc file with Python path and MSVS version
echo "=== Configuring .npmrc file ==="
echo "python=$PYTHON_PATH" >> ~/.npmrc
if [[ "$PLATFORM" == "windows" ]]; then
  echo "msvs_version=2019" >> ~/.npmrc
fi

# Show the .npmrc file
echo "=== Contents of .npmrc ==="
cat ~/.npmrc

# Install dependencies
echo "=== Installing dependencies ==="
npm install --legacy-peer-deps

# Check for native dependencies in the root package.json
echo "=== Checking for native dependencies ==="
NATIVE_DEPS=$(find node_modules -maxdepth 2 -name "binding.gyp" | cut -d'/' -f2 | tr '\n' ' ')
if [ -n "$NATIVE_DEPS" ]; then
  echo "Warning: Found native dependencies in root package.json: $NATIVE_DEPS"
  echo "These should be moved to release/app/package.json"
fi

# Install dependencies in release/app
echo "=== Installing dependencies in release/app ==="
cd release/app
npm install --ignore-scripts

# Rebuild native modules for the current platform
echo "=== Rebuilding native modules ==="

# Rebuild better-sqlite3 for Electron
npx electron-rebuild -f -w better-sqlite3 -v 26.6.10

# Check the installed packages
npm list better-sqlite3

# Check the binary module
if [[ "$PLATFORM" == "linux" || "$PLATFORM" == "macos" ]]; then
  find node_modules/better-sqlite3 -name "*.node" || echo "No .node files found"
elif [[ "$PLATFORM" == "windows" ]]; then
  dir node_modules\\better-sqlite3\\build\\Release || echo "No .node files found"
fi

cd ../..

# Run tests
echo "=== Running tests ==="
npm test

# Test packaging for the current platform
echo "=== Testing packaging for $PLATFORM ==="
if [[ "$PLATFORM" == "linux" ]]; then
  npm run package:linux -- --dir
elif [[ "$PLATFORM" == "macos" ]]; then
  npm run package:mac -- --dir
elif [[ "$PLATFORM" == "windows" ]]; then
  npm run package:win -- --dir
fi

echo "=== Workflow test completed ==="

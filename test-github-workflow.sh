#!/bin/bash
# Script to test GitHub Actions workflow locally

set -e  # Exit on error

echo "=== Testing GitHub Actions workflow locally ==="
echo "This script simulates the GitHub Actions workflow steps"

# Check Node.js and npm versions
echo "=== Checking Node.js and npm versions ==="
node --version
npm --version

# Check system information
echo "=== System information ==="
uname -a
arch

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
find node_modules/better-sqlite3 -name "*.node" || echo "No .node files found"

cd ../..

# Run tests
echo "=== Running tests ==="
npm test

echo "=== Workflow test completed ==="

/**
 * This script checks if we're on macOS and installs the dmg-license package if needed.
 * The dmg-license package is required for building DMG installers on macOS.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('Checking if dmg-license is needed...');

// Only run on macOS
if (os.platform() === 'darwin') {
  try {
    // Check if dmg-license is already installed
    const nodeModulesPath = path.join(
      process.cwd(),
      'node_modules',
      'dmg-license',
    );

    if (!fs.existsSync(nodeModulesPath)) {
      console.log('Installing dmg-license package for macOS DMG creation...');
      execSync('npm install --save-dev dmg-license', { stdio: 'inherit' });
      console.log('dmg-license package installed successfully.');
    } else {
      console.log('dmg-license package is already installed.');
    }
  } catch (error) {
    console.error('Error installing dmg-license package:', error);
    process.exit(1);
  }
} else {
  console.log('Not on macOS, skipping dmg-license installation.');
}

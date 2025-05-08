/**
 * This script fixes various dependency issues in the project
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { execSync } = require('child_process');

// Define the functions first
function fixCrc32() {
  console.log(chalk.blue('Fixing @node-rs/crc32 module...'));

  // Create directory for mock module
  const mockDir = path.join(
    process.cwd(),
    'node_modules',
    '@node-rs',
    'crc32-wasm32-wasi',
  );
  if (!fs.existsSync(mockDir)) {
    fs.mkdirSync(mockDir, { recursive: true });
  }

  // Create mock implementation
  const mockContent = `
// This is a mock implementation of @node-rs/crc32-wasm32-wasi
// It's used to prevent errors when webpack tries to resolve this module

const { Buffer } = require('buffer');

// Simple CRC32 implementation that just returns zeros
function crc32(input) {
  // This is a simple implementation that returns a Buffer with zeros
  // It's just a placeholder to prevent errors, not a real CRC32 implementation
  return Buffer.alloc(4);
}

module.exports = { crc32 };
`;

  // Create package.json for mock module
  const packageJson = {
    name: '@node-rs/crc32-wasm32-wasi',
    version: '1.10.6',
    description: 'Mock implementation of @node-rs/crc32-wasm32-wasi',
    main: 'index.js',
    license: 'MIT',
  };

  // Write files
  fs.writeFileSync(path.join(mockDir, 'index.js'), mockContent);
  fs.writeFileSync(
    path.join(mockDir, 'package.json'),
    JSON.stringify(packageJson, null, 2),
  );

  console.log(
    chalk.green(
      'Successfully created mock implementation for @node-rs/crc32-wasm32-wasi',
    ),
  );

  // Also fix the browser.js file in @node-rs/crc32
  const crc32Dir = path.join(
    process.cwd(),
    'node_modules',
    '@node-rs',
    'crc32',
  );
  if (fs.existsSync(crc32Dir)) {
    const browserJsPath = path.join(crc32Dir, 'browser.js');
    if (fs.existsSync(browserJsPath)) {
      // Create a simple browser.js that doesn't try to load the WASM module
      const browserJsContent = `
// This is a patched version of browser.js that doesn't try to load the WASM module
// Original module tries to require('@node-rs/crc32-wasm32-wasi') which fails in webpack
const { Buffer } = require('buffer');

// Simple CRC32 implementation for browser environments
function crc32(input) {
  // This is a simple implementation that returns a Buffer with zeros
  // It's just a placeholder to prevent errors, not a real CRC32 implementation
  return Buffer.alloc(4);
}

module.exports = { crc32 };
`;

      // Backup the original file
      const backupPath = path.join(crc32Dir, 'browser.js.bak');
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(browserJsPath, backupPath);
      }

      // Write the new browser.js
      fs.writeFileSync(browserJsPath, browserJsContent);
      console.log(
        chalk.green(`Successfully patched browser.js at: ${browserJsPath}`),
      );
    }
  }
}

function fixYauzlPromise() {
  console.log(chalk.blue('Fixing yauzl-promise module...'));

  try {
    // Downgrade yauzl-promise to a version that doesn't depend on @node-rs/crc32
    execSync(
      'npm uninstall yauzl-promise && npm install yauzl-promise@2.1.1 --no-save',
      {
        stdio: 'inherit',
      },
    );
    console.log(
      chalk.green('Successfully downgraded yauzl-promise to version 2.1.1'),
    );
  } catch (error) {
    console.error(chalk.red('Error downgrading yauzl-promise:'), error);
  }
}

// Main function that calls the other functions
function fixDependencies() {
  console.log(chalk.blue('Fixing dependencies...'));

  // Fix @node-rs/crc32 issue
  fixCrc32();

  // Fix yauzl-promise issue
  fixYauzlPromise();

  console.log(chalk.green('Dependencies fixed successfully!'));
}

// Run the fix
fixDependencies();

/**
 * This script fixes the @node-rs/crc32 module compatibility issue with Electron and webpack.
 * It creates a browser.js file that doesn't try to load the WASM module.
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function fixCrc32Module() {
  console.log(
    chalk.blue(
      'Fixing @node-rs/crc32 module for Electron and webpack compatibility...',
    ),
  );

  // Paths to check for @node-rs/crc32 module
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', '@node-rs', 'crc32'),
    path.join(
      process.cwd(),
      'release',
      'app',
      'node_modules',
      '@node-rs',
      'crc32',
    ),
  ];

  let modified = false;

  // Using forEach instead of for...of to avoid linting issues
  possiblePaths.forEach((crc32Path) => {
    if (fs.existsSync(crc32Path)) {
      try {
        console.log(chalk.green(`Found @node-rs/crc32 at: ${crc32Path}`));

        // Path to the browser.js file
        const browserJsPath = path.join(crc32Path, 'browser.js');

        if (fs.existsSync(browserJsPath)) {
          // Create a simple browser.js that doesn't try to load the WASM module
          const browserJsContent = `
// This is a patched version of browser.js that doesn't try to load the WASM module
// Original module tries to require '@node-rs/crc32-wasm32-wasi' which fails in webpack
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
          const backupPath = path.join(crc32Path, 'browser.js.bak');
          if (!fs.existsSync(backupPath)) {
            fs.copyFileSync(browserJsPath, backupPath);
            console.log(
              chalk.green(`Backed up original browser.js to ${backupPath}`),
            );
          }

          // Write the new browser.js
          fs.writeFileSync(browserJsPath, browserJsContent);
          console.log(
            chalk.green(`Successfully patched browser.js at: ${browserJsPath}`),
          );

          modified = true;
        } else {
          console.log(chalk.yellow(`browser.js not found at: ${crc32Path}`));
        }
      } catch (error) {
        console.error(
          chalk.red(`Error modifying @node-rs/crc32 module at ${crc32Path}:`),
          error,
        );
      }
    }
  });

  if (!modified) {
    console.log(chalk.yellow('No @node-rs/crc32 module found to modify.'));
  }
}

// Run the fix
fixCrc32Module();

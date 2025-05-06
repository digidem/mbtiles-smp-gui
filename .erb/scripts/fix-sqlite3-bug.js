/**
 * This script fixes the better-sqlite3 binary compatibility issue with Electron on macOS, Linux, and Windows.
 * It modifies the better-sqlite3 package.json to use the correct binary configuration.
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

function fixBetterSqlite3() {
  console.log(
    chalk.blue(
      'Fixing better-sqlite3 binary configuration for Electron compatibility...',
    ),
  );

  // Paths to check for better-sqlite3 package.json
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'better-sqlite3', 'package.json'),
    path.join(
      process.cwd(),
      'release',
      'app',
      'node_modules',
      'better-sqlite3',
      'package.json',
    ),
  ];

  let modified = false;
  const platform = os.platform();
  console.log(chalk.blue(`Detected platform: ${platform}`));

  // Using forEach instead of for...of to avoid linting issues
  possiblePaths.forEach((sqlitePath) => {
    if (fs.existsSync(sqlitePath)) {
      try {
        console.log(chalk.green(`Found better-sqlite3 at: ${sqlitePath}`));
        // eslint-disable-next-line import/no-dynamic-require, global-require
        const sqlite = require(sqlitePath);

        // Set the binary configuration if needed
        if (!sqlite.binary) {
          sqlite.binary = {};
        }

        // Apply platform-specific fixes
        if (platform === 'darwin') {
          console.log(chalk.blue('Applying macOS-specific fixes...'));
          sqlite.binary.napi_versions = [6];
        } else if (platform === 'linux') {
          console.log(chalk.blue('Applying Linux-specific fixes...'));
          sqlite.binary.napi_versions = [6];
          // Add Linux-specific settings if needed
          sqlite.binary.module_name = 'better_sqlite3';
          sqlite.binary.module_path = './build/Release';
        } else if (platform === 'win32') {
          console.log(chalk.blue('Applying Windows-specific fixes...'));
          sqlite.binary.napi_versions = [6];
          // Add Windows-specific settings if needed
          sqlite.binary.module_name = 'better_sqlite3';
          sqlite.binary.module_path = './build/Release';
        }

        // Write the modified package.json back
        fs.writeFileSync(sqlitePath, JSON.stringify(sqlite, null, 2));
        console.log(
          chalk.green(
            `Successfully modified better-sqlite3 package.json at: ${sqlitePath}`,
          ),
        );

        // Check if binding.gyp exists and modify it if needed
        const bindingGyp = path.join(path.dirname(sqlitePath), 'binding.gyp');
        if (fs.existsSync(bindingGyp)) {
          try {
            console.log(chalk.blue(`Found binding.gyp at: ${bindingGyp}`));
            const bindingContent = fs.readFileSync(bindingGyp, 'utf8');

            // Only modify if we're on Linux and it doesn't already have the right settings
            if (platform === 'linux' && !bindingContent.includes('"-fPIC"')) {
              console.log(chalk.blue('Modifying binding.gyp for Linux...'));
              // This is a simple string replacement - in a real scenario you might want to parse the file properly
              const modifiedBinding = bindingContent.replace(
                '"cflags": [',
                '"cflags": [ "-fPIC", ',
              );
              fs.writeFileSync(bindingGyp, modifiedBinding);
              console.log(chalk.green('Successfully modified binding.gyp'));
            }
          } catch (bindingError) {
            console.error(
              chalk.red(`Error modifying binding.gyp at ${bindingGyp}:`),
              bindingError,
            );
          }
        }

        modified = true;
      } catch (error) {
        console.error(
          chalk.red(
            `Error modifying better-sqlite3 package.json at ${sqlitePath}:`,
          ),
          error,
        );
      }
    }
  });

  if (!modified) {
    console.log(
      chalk.yellow('No better-sqlite3 package.json found to modify.'),
    );
  }
}

// Run the fix
fixBetterSqlite3();

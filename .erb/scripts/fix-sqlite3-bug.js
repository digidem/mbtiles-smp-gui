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
          console.log(
            chalk.blue(
              'Applying Linux-specific fixes for GLIBC compatibility...',
            ),
          );
          sqlite.binary.napi_versions = [6];
          // Add Linux-specific settings for better compatibility
          sqlite.binary.module_name = 'better_sqlite3';
          sqlite.binary.module_path = './build/Release';

          // Add specific settings for older GLIBC compatibility
          if (!sqlite.binary.linux) {
            sqlite.binary.linux = {};
          }

          // Target older GLIBC versions
          sqlite.binary.linux.runtime = 'glibc';
          sqlite.binary.linux.abi = 'node_napi';

          console.log(
            chalk.green('Applied Linux-specific GLIBC compatibility fixes'),
          );
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
            if (platform === 'linux') {
              console.log(
                chalk.blue(
                  'Modifying binding.gyp for Linux with GLIBC compatibility flags...',
                ),
              );

              // Add multiple flags for better compatibility with older systems
              let modifiedBinding = bindingContent;

              // Add -fPIC flag if not already present
              if (!bindingContent.includes('"-fPIC"')) {
                modifiedBinding = modifiedBinding.replace(
                  '"cflags": [',
                  '"cflags": [ "-fPIC", ',
                );
              }

              // Add GLIBC compatibility flags if not already present
              if (!bindingContent.includes('"-D_LARGEFILE64_SOURCE"')) {
                modifiedBinding = modifiedBinding.replace(
                  '"cflags": [',
                  '"cflags": [ "-D_LARGEFILE64_SOURCE", "-D_FILE_OFFSET_BITS=64", ',
                );
              }

              // Add C++ flags for GLIBC compatibility
              if (!bindingContent.includes('"cxxflags"')) {
                // Find the closing bracket of the cflags array
                const cflagsEndPos = modifiedBinding.indexOf(
                  '],',
                  modifiedBinding.indexOf('"cflags": ['),
                );
                if (cflagsEndPos !== -1) {
                  modifiedBinding = `${modifiedBinding.slice(
                    0,
                    cflagsEndPos + 2,
                  )}\n      "cxxflags": [ "-D_LARGEFILE64_SOURCE", "-D_FILE_OFFSET_BITS=64", "-fPIC" ],${modifiedBinding.slice(
                    cflagsEndPos + 2,
                  )}`;
                }
              }

              fs.writeFileSync(bindingGyp, modifiedBinding);
              console.log(
                chalk.green(
                  'Successfully modified binding.gyp with GLIBC compatibility flags',
                ),
              );
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

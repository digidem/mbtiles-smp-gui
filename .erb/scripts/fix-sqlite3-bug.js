/**
 * This script fixes the better-sqlite3 binary compatibility issue with Electron on macOS.
 * It modifies the better-sqlite3 package.json to use the correct binary configuration.
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

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

        sqlite.binary.napi_versions = [6];

        // Write the modified package.json back
        fs.writeFileSync(sqlitePath, JSON.stringify(sqlite, null, 2));
        console.log(
          chalk.green(
            `Successfully modified better-sqlite3 package.json at: ${sqlitePath}`,
          ),
        );
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

/**
 * This script fixes the sqlite3 binary compatibility issue with Electron on macOS.
 * It modifies the sqlite3 package.json to use the correct binary configuration.
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

function fixSqlite3() {
  console.log(
    chalk.blue(
      'Fixing sqlite3 binary configuration for Electron compatibility...',
    ),
  );

  // Paths to check for sqlite3 package.json
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sqlite3', 'package.json'),
    path.join(
      process.cwd(),
      'release',
      'app',
      'node_modules',
      'sqlite3',
      'package.json',
    ),
  ];

  let modified = false;

  // Using forEach instead of for...of to avoid linting issues
  possiblePaths.forEach((sqlite3Path) => {
    if (fs.existsSync(sqlite3Path)) {
      try {
        console.log(chalk.green(`Found sqlite3 at: ${sqlite3Path}`));
        // eslint-disable-next-line import/no-dynamic-require, global-require
        const sqlite3 = require(sqlite3Path);

        // Set the binary configuration
        sqlite3.binary = {
          napi_versions: [6],
        };

        // Write the modified package.json back
        fs.writeFileSync(sqlite3Path, JSON.stringify(sqlite3, null, 2));
        console.log(
          chalk.green(
            `Successfully modified sqlite3 package.json at: ${sqlite3Path}`,
          ),
        );
        modified = true;
      } catch (error) {
        console.error(
          chalk.red(`Error modifying sqlite3 package.json at ${sqlite3Path}:`),
          error,
        );
      }
    }
  });

  if (!modified) {
    console.log(chalk.yellow('No sqlite3 package.json found to modify.'));
  }
}

// Run the fix
fixSqlite3();

/**
 * This script is specifically designed to rebuild native modules for Linux in Electron.
 * It provides additional debugging and error handling for Linux-specific issues.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const os = require('os');

// Only run on Linux
if (os.platform() !== 'linux') {
  console.log(chalk.yellow('This script is intended for Linux only. Exiting.'));
  process.exit(0);
}

console.log(chalk.blue('Starting Linux-specific electron-rebuild process...'));

// Get the Electron version from package.json
let electronVersion;
try {
  const packageJson = require(path.join(process.cwd(), 'package.json'));
  electronVersion = packageJson.devDependencies.electron.replace('^', '');
  console.log(chalk.green(`Detected Electron version: ${electronVersion}`));
} catch (error) {
  console.error(chalk.red('Failed to detect Electron version:'), error);
  electronVersion = '26.6.10'; // Fallback to the version in the workflow
  console.log(
    chalk.yellow(`Using fallback Electron version: ${electronVersion}`),
  );
}

// Path to the app's node_modules
const appNodeModulesPath = path.join(
  process.cwd(),
  'release',
  'app',
  'node_modules',
);

// Check if better-sqlite3 is installed
const betterSqlitePath = path.join(appNodeModulesPath, 'better-sqlite3');
if (!fs.existsSync(betterSqlitePath)) {
  console.error(
    chalk.red('better-sqlite3 module not found. Make sure it is installed.'),
  );
  process.exit(1);
}

// Run commands with verbose output
function runCommand(command, cwd = process.cwd()) {
  console.log(chalk.blue(`Running command: ${command}`));
  try {
    const output = execSync(command, {
      cwd,
      stdio: 'pipe',
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for verbose output
    });
    console.log(chalk.green('Command succeeded:'));
    console.log(output);
    return output;
  } catch (error) {
    console.error(chalk.red('Command failed:'));
    console.error(error.stdout || '');
    console.error(error.stderr || '');
    throw error;
  }
}

// Main rebuild process
async function rebuildNativeModules() {
  try {
    // Change to the app directory
    process.chdir(path.join(process.cwd(), 'release', 'app'));
    console.log(chalk.blue(`Changed directory to: ${process.cwd()}`));

    // Check for node-gyp
    try {
      runCommand('node-gyp --version');
    } catch (error) {
      console.log(chalk.yellow('node-gyp not found globally, installing...'));
      runCommand('npm install -g node-gyp');
    }

    // Uninstall better-sqlite3 first
    console.log(chalk.blue('Removing existing better-sqlite3...'));
    try {
      runCommand('npm uninstall better-sqlite3');
    } catch (error) {
      console.log(
        chalk.yellow('Failed to uninstall better-sqlite3, continuing...'),
      );
    }

    // Install better-sqlite3 with build from source and specific flags for older glibc compatibility
    console.log(
      chalk.blue(
        'Installing better-sqlite3 from source with older glibc compatibility...',
      ),
    );
    runCommand(
      'npm install better-sqlite3@11.9.1 --build-from-source --no-save',
    );

    // Set environment variables to ensure compatibility with older glibc
    console.log(
      chalk.blue(
        'Setting environment variables for older glibc compatibility...',
      ),
    );
    process.env.CFLAGS = '-D_LARGEFILE64_SOURCE -D_FILE_OFFSET_BITS=64 -fPIC';
    process.env.CXXFLAGS = '-D_LARGEFILE64_SOURCE -D_FILE_OFFSET_BITS=64 -fPIC';

    // Create a .npmrc file with specific node-gyp configuration
    console.log(
      chalk.blue('Creating .npmrc with specific node-gyp configuration...'),
    );
    fs.writeFileSync(
      '.npmrc',
      'node-gyp-binary[platform]=linux\nnode-gyp-binary[arch]=x64\n',
    );

    // Run electron-rebuild with verbose output and specific flags for older glibc compatibility
    console.log(
      chalk.blue('Running electron-rebuild with compatibility flags...'),
    );
    runCommand(
      `npx electron-rebuild -f -w better-sqlite3 -v ${electronVersion} --arch=x64 --verbose --dist-url=https://electronjs.org/headers`,
    );

    // Apply additional compatibility fixes
    console.log(chalk.blue('Applying additional compatibility fixes...'));

    // Check if the binary exists and apply additional fixes if needed
    const binaryPath = path.join(
      process.cwd(),
      'node_modules',
      'better-sqlite3',
      'build',
      'Release',
      'better_sqlite3.node',
    );

    if (fs.existsSync(binaryPath)) {
      console.log(chalk.green(`Found binary at ${binaryPath}`));

      // Create a backup of the binary
      const backupPath = `${binaryPath}.backup`;
      fs.copyFileSync(binaryPath, backupPath);
      console.log(chalk.green(`Created backup at ${backupPath}`));

      // We could apply additional binary patching here if needed
      // For now, we'll just rely on the build flags
    } else {
      console.log(
        chalk.yellow(`Binary not found at expected path: ${binaryPath}`),
      );
      // Try to find it elsewhere
      runCommand('find node_modules -name "*.node" | grep better-sqlite3');
    }

    // Run the fix-sqlite3-bug script
    console.log(chalk.blue('Running fix-sqlite3-bug script...'));
    runCommand('node ../../.erb/scripts/fix-sqlite3-bug.js');

    // Verify the installation
    console.log(chalk.blue('Verifying better-sqlite3 installation...'));
    runCommand('npm list better-sqlite3');

    // Check for the binary
    console.log(chalk.blue('Checking for better-sqlite3 binary...'));
    const findResult = runCommand(
      'find node_modules/better-sqlite3 -name "*.node" | sort',
    );

    if (!findResult.trim()) {
      console.log(chalk.red('No binary found for better-sqlite3!'));

      // Check the build directory structure
      console.log(chalk.blue('Checking build directory structure...'));
      runCommand(
        'find node_modules/better-sqlite3/build -type f | sort || echo "No build directory found"',
      );

      throw new Error('Failed to build better-sqlite3 binary');
    }

    console.log(
      chalk.green('Successfully rebuilt better-sqlite3 for Electron on Linux!'),
    );
  } catch (error) {
    console.error(chalk.red('Failed to rebuild native modules:'), error);
    process.exit(1);
  }
}

// Run the rebuild process
rebuildNativeModules();

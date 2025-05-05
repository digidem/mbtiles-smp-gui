import { execSync } from 'child_process';
import fs from 'fs';
import { dependencies } from '../../release/app/package.json';
import webpackPaths from '../configs/webpack.paths';

if (
  Object.keys(dependencies || {}).length > 0 &&
  fs.existsSync(webpackPaths.appNodeModulesPath)
) {
  // Set environment variables for the rebuild
  process.env.npm_config_build_from_source = 'true';
  process.env.npm_config_runtime = 'electron';
  process.env.npm_config_target = '26.6.10';
  process.env.npm_config_disturl = 'https://electronjs.org/headers';

  // Special handling for macOS
  if (process.platform === 'darwin') {
    // For macOS, we'll use npm install directly with the correct flags
    // First, uninstall sqlite3
    try {
      execSync('npm uninstall sqlite3', {
        cwd: webpackPaths.appPath,
        stdio: 'inherit',
      });
    } catch (error) {
      console.error('Error uninstalling sqlite3:', error);
    }

    // Then install it with the suggested approach
    try {
      execSync(
        'npm install sqlite3 --build-from-source --target_arch=arm64 --fallback-to-build',
        {
          cwd: webpackPaths.appPath,
          stdio: 'inherit',
        },
      );
    } catch (error) {
      console.error('Error installing sqlite3:', error);
    }

    // Rebuild other modules if needed
    const otherModulesCmd =
      '../../node_modules/.bin/electron-rebuild --force --types prod,dev,optional --module-dir . --skip sqlite3';
    execSync(otherModulesCmd, {
      cwd: webpackPaths.appPath,
      stdio: 'inherit',
    });
  } else {
    // For non-macOS platforms
    const electronRebuildCmd =
      '../../node_modules/.bin/electron-rebuild --force --types prod,dev,optional --module-dir .';
    const cmd =
      process.platform === 'win32'
        ? electronRebuildCmd.replace(/\//g, '\\')
        : electronRebuildCmd;
    execSync(cmd, {
      cwd: webpackPaths.appPath,
      stdio: 'inherit',
    });
  }
}

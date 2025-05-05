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
    const electronRebuildCmd =
      '../../node_modules/.bin/electron-rebuild --force --types prod,dev,optional --module-dir . --only sqlite3';
    execSync(electronRebuildCmd, {
      cwd: webpackPaths.appPath,
      stdio: 'inherit',
    });

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

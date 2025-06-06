/**
 * This is a CommonJS version of the check-native-dep.js script
 * It's designed to work with node without requiring ES module support
 */
const fs = require('fs');
const chalk = require('chalk');
const { execSync } = require('child_process');
const packageJson = require('../../package.json');

const { dependencies } = packageJson;

// Check if --force flag is passed
const forceFlag = process.argv.includes('--force');

if (dependencies) {
  const dependenciesKeys = Object.keys(dependencies);
  const nativeDeps = fs
    .readdirSync('node_modules')
    .filter((folder) => fs.existsSync(`node_modules/${folder}/binding.gyp`));
  if (nativeDeps.length === 0) {
    process.exit(0);
  }
  try {
    // Find the reason for why the dependency is installed. If it is installed
    // because of a devDependency then that is okay. Warn when it is installed
    // because of a dependency
    const dependenciesObject = JSON.parse(
      execSync(`npm ls ${nativeDeps.join(' ')} --json`).toString(),
    ).dependencies;
    const rootDependencies = Object.keys(dependenciesObject);
    const filteredRootDependencies = rootDependencies.filter((rootDependency) =>
      dependenciesKeys.includes(rootDependency),
    );
    if (filteredRootDependencies.length > 0) {
      const plural = filteredRootDependencies.length > 1;
      console.log(`
 ${chalk.whiteBright.bgYellow.bold(
   'Webpack does not work with native dependencies.',
 )}
${chalk.bold(filteredRootDependencies.join(', '))} ${
        plural ? 'are native dependencies' : 'is a native dependency'
      } and should be installed inside of the "./release/app" folder.
 First, uninstall the packages from "./package.json":
${chalk.whiteBright.bgGreen.bold('npm uninstall your-package')}
 ${chalk.bold(
   'Then, instead of installing the package to the root "./package.json":',
 )}
${chalk.whiteBright.bgRed.bold('npm install your-package')}
 ${chalk.bold('Install the package to "./release/app/package.json"')}
${chalk.whiteBright.bgGreen.bold(
  'cd ./release/app && npm install your-package',
)}
 Read more about native dependencies at:
${chalk.bold(
  'https://electron-react-boilerplate.js.org/docs/adding-dependencies/#module-structure',
)}
 `);

      // Only exit with error if --force flag is not provided
      if (!forceFlag) {
        process.exit(1);
      } else {
        console.log(
          chalk.yellow(
            'Continuing despite native dependencies (--force flag used)',
          ),
        );
      }
    }
  } catch (e) {
    console.log('Native dependencies could not be checked');
    console.error(e);
  }
}

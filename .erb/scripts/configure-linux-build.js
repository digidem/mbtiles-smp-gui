/**
 * This script configures electron-builder for Linux to ensure compatibility with older distributions.
 * It modifies the electron-builder configuration to use older glibc versions.
 */
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(
  chalk.blue('Configuring electron-builder for Linux compatibility...'),
);

// Path to the electron-builder.yml file we'll create
const electronBuilderConfigPath = path.join(
  process.cwd(),
  'electron-builder.yml',
);

// Check if the file already exists
if (fs.existsSync(electronBuilderConfigPath)) {
  console.log(
    chalk.yellow(`${electronBuilderConfigPath} already exists, updating...`),
  );
} else {
  console.log(chalk.green(`Creating ${electronBuilderConfigPath}...`));
}

// Configuration to ensure compatibility with older Linux distributions
const electronBuilderConfig = `
# This configuration extends the settings in package.json
# It's specifically for Linux builds to ensure compatibility with older distributions

# Use specific electron version for better compatibility
electronDist: node_modules/electron/dist
electronVersion: 26.6.10

# Set specific environment variables for better compatibility
npmArgs:
  - "--no-optional"

# Linux configuration for better compatibility
linux:
  # Force use of older glibc for better compatibility
  executableArgs:
    - "--no-sandbox"
  # Ensure compatibility with older systems
  artifactName: "\${productName}-\${version}-\${arch}.AppImage"
  # Target older systems
  target:
    - target: AppImage
      arch:
        - x64

# Ensure we use a compatible build environment
buildDependenciesFromSource: true
nodeGypRebuild: true

# Disable asar to help with troubleshooting
asar: false

# Additional build options
npmRebuild: true
`;

// Write the configuration file
fs.writeFileSync(electronBuilderConfigPath, electronBuilderConfig);
console.log(
  chalk.green(`Successfully created/updated ${electronBuilderConfigPath}`),
);

// Now let's modify the package.json script for Linux builds
try {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = require(packageJsonPath);

  // Update the package:linux script to use our configuration
  if (packageJson.scripts && packageJson.scripts['package:linux']) {
    const originalScript = packageJson.scripts['package:linux'];

    // Only modify if it doesn't already include our configuration
    if (!originalScript.includes('--config electron-builder.yml')) {
      packageJson.scripts['package:linux'] = originalScript.replace(
        'npx electron-builder build --linux',
        'npx electron-builder build --linux --config electron-builder.yml',
      );

      // Write the updated package.json
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(
        chalk.green(
          'Successfully updated package:linux script in package.json',
        ),
      );
    } else {
      console.log(
        chalk.yellow('package:linux script already includes our configuration'),
      );
    }
  } else {
    console.log(
      chalk.red('Could not find package:linux script in package.json'),
    );
  }
} catch (error) {
  console.error(chalk.red('Error updating package.json:'), error);
}

console.log(chalk.blue('Linux build configuration complete!'));

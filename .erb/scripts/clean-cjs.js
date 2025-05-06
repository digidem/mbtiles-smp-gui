/**
 * This is a CommonJS version of the clean.js script
 * It's designed to work with npx ts-node without requiring ES module support
 */
const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');

// Get the paths from command line arguments or use defaults
const args = process.argv.slice(2);
const distPath = args[0] || path.join(__dirname, '../../dist');
const buildPath = path.join(__dirname, '../../.erb/dll');
const dllPath = path.join(__dirname, '../../.erb/dll');

const foldersToRemove = [distPath, buildPath, dllPath];

console.log('Cleaning folders:');
foldersToRemove.forEach((folder) => {
  console.log(`- ${folder}`);
  if (fs.existsSync(folder)) {
    try {
      rimraf.sync(folder);
      console.log(`  Successfully removed ${folder}`);
    } catch (error) {
      console.error(`  Error removing ${folder}:`, error);
    }
  } else {
    console.log(`  Folder ${folder} does not exist, skipping`);
  }
});

console.log('Clean completed');

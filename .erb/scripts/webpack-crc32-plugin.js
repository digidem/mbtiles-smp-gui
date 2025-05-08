/**
 * This is a webpack plugin that provides a mock implementation for @node-rs/crc32-wasm32-wasi
 */
// const path = require('path');
// const fs = require('fs');

class Crc32WasmPlugin {
  // eslint-disable-next-line class-methods-use-this
  apply(compiler) {
    // Create a virtual module for @node-rs/crc32-wasm32-wasi
    compiler.hooks.beforeCompile.tap('Crc32WasmPlugin', () => {
      // Create a simple mock implementation
      const mockContent = `
// This is a mock implementation of @node-rs/crc32-wasm32-wasi
module.exports = {
  crc32: function(input) {
    // Return a buffer with zeros (just a placeholder)
    return Buffer.alloc(4);
  }
};
`;

      // Create a virtual module
      const VirtualModulesPlugin = require('webpack-virtual-modules');
      const virtualModules = new VirtualModulesPlugin({
        'node_modules/@node-rs/crc32-wasm32-wasi/index.js': mockContent,
      });

      virtualModules.apply(compiler);
    });
  }
}

module.exports = Crc32WasmPlugin;

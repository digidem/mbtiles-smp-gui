/**
 * Base webpack config used across other specific configs
 */

import webpack from 'webpack';
import path from 'path';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import { dependencies as externals } from '../../release/app/package.json';
// Import our custom plugin
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Crc32WasmPlugin = require('../scripts/webpack-crc32-plugin');

const configuration: webpack.Configuration = {
  externals: [...Object.keys(externals || {})],

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            compilerOptions: {
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
            },
          },
        },
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: {
      type: 'commonjs2',
    },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    // There is no need to add aliases here, the paths in tsconfig get mirrored
    plugins: [new TsconfigPathsPlugins()],
    // Add fallbacks for problematic modules
    fallback: {
      '@node-rs/crc32-wasm32-wasi': false,
    },
    // Add aliases for problematic modules
    alias: {
      '@node-rs/crc32': path.join(
        webpackPaths.rootPath,
        'node_modules',
        '@node-rs',
        'crc32-browser.js',
      ),
    },
  },

  plugins: [
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
    }),
    // Add our custom plugin to handle @node-rs/crc32-wasm32-wasi
    new Crc32WasmPlugin(),
  ],
};

export default configuration;

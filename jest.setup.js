// Add TextEncoder and TextDecoder to the global scope
if (typeof TextEncoder === 'undefined') {
  // eslint-disable-next-line global-require
  const { TextEncoder: NodeTextEncoder } = require('util');
  global.TextEncoder = NodeTextEncoder;
}

if (typeof TextDecoder === 'undefined') {
  // eslint-disable-next-line global-require
  const { TextDecoder: NodeTextDecoder } = require('util');
  global.TextDecoder = NodeTextDecoder;
}

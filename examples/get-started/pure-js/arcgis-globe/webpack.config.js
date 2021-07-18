// NOTE: To use this example standalone (e.g. outside of deck.gl repo)
// delete the local development overrides at the bottom of this file

const CONFIG = {
  mode: 'development',

  entry: {
    app: './app.js'
  }
};

// This line enables bundling against src in this repo rather than installed module
module.exports = env => (env ? require('../../../webpack.config.local')(CONFIG)(env) : CONFIG);

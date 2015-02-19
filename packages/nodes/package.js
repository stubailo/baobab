Package.describe({
  name: 'nodes',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: '',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.0.3.1');

  api.addFiles("node-model.js");
  api.addFiles("node-trusted-api.js");
  api.addFiles("node-methods.js");
  api.addFiles('nodes.js');
  api.addFiles('node-publish.js');
  api.export("Nodes");
  api.export("NodeTrustedApi");

  api.use(["mongo", "check", "underscore"]);
});

Package.onTest(function(api) {
  api.use(['tinytest', 'accounts-password', 'random', 'check']);
  api.use('nodes');
  api.addFiles('nodes-server-tests.js', "server");
  api.addFiles('nodes-client-tests.js', "client");
});

// If someone shares a document with you via a link, the link will have a
// special token to authorize you to read things and edit things.
getUrlAuthToken = function () {
  return Router.current().params.query.token;
};

Router.route('/', function () {
  var user = Meteor.user();
  if (user) {
    var rootNode = Nodes.findOne(user.rootNodeId);
    if (rootNode) {
      Session.set("rootNodeId", rootNode._id);
    }
  }

  this.render('tree', {
    data: rootNode
  });
});

// example.com/asdfasdfads?token=asdfasdfasdf
Router.route('/:_id', function () {
  if (getUrlAuthToken()) {
    this.subscribe("nodesTokenAuth", getUrlAuthToken());
  }

  var rootNode = Nodes.findOne(this.params._id);
  if (rootNode) {
    Session.set("rootNodeId", rootNode._id);
  }

  this.render('tree', {
    data: rootNode
  });
});

// If someone shares a document with you via a link, the link will have a
// special token to authorize you to read things and edit things.
getUrlAuthToken = function () {
  return Router.current().params.query.token;
};

Router.route('/', function () {
  var self = this;

  self.render('tree', {
    data: function() {
      var user = Meteor.user();
      if (user) {
        var rootNode = Nodes.findOne(user.rootNodeId);
        if (rootNode) {
          Session.set("rootNodeId", rootNode._id);
        }
        return rootNode;
      }
    }
  });
});

// example.com/asdfasdfads?token=asdfasdfasdf
Router.route('/:_id', function () {
  var self = this;

  if (getUrlAuthToken()) {
    self.subscribe("nodesTokenAuth", getUrlAuthToken());
  }

  self.render('tree', {
    data: function() {
      var rootNode = Nodes.findOne(self.params._id);
      if (rootNode) {
        Session.set("rootNodeId", rootNode._id);
      }
      return rootNode;
    }
  });
});

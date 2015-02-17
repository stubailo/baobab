// If someone shares a document with you via a link, the link will have a
// special token to authorize you to read things and edit things.
getUrlAuthToken = function () {
  return Router.current().params.query.token;
};

Router.route('/', function () {
  this.render('tree', {
    data: function() {
      if (Meteor.user()) {
        return Nodes.findOne(Meteor.user().rootNodeId);
      }
    }
  });
});

// example.com/asdfasdfads?token=asdfasdfasdf
Router.route('/:_id', function () {
  if (getUrlAuthToken()) {
    this.subscribe("nodesTokenAuth", getUrlAuthToken());
  }

  this.render('tree', {
    data: function() {
      return Nodes.findOne(this.params._id);
    }
  });
});

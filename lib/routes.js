
Router.route('/', function () {
  this.render('tree', {
    data: function() {
      if (Meteor.user()) {
        return Nodes.findOne(Meteor.user().rootNodeId);
      }
    }
  });
});

Router.route('/:_id', function () {
  this.render('tree', {
    data: function() {
      return Nodes.findOne(this.params._id);
    }
  });
});

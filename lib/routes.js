
Router.route('/', function () {
  this.render('tree', {
    data: function() {
      return Nodes.findOne({ content: null });
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


Router.route('/', function () {
  this.render('tree', {
    data: function() {
      return NodesLocal.findOne({ body: null });
    }
  });
});

Router.route('/:_id', function () {
  this.render('tree', {
    data: function() {
      return NodesLocal.findOne(this.params._id);
    }
  });
});


Router.route('/', function () {
  this.render('node', {
    data: function() {
      return NodesLocal.findOne({ body: null });
    }
  });
});

Router.route('/:_id', function () {
  this.render('node', {
    data: function() {
      return NodesLocal.findOne(this.params._id);
    }
  });
});

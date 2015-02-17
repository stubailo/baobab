
Router.route('/', function () {
  this.render('node', {
    data: function() {
      var found = NodesLocal.findOne({ body: null });
      console.log(found);
      return found;
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

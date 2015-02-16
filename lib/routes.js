
Router.route('/', function () {
  this.render('tree', {
    data: function () {
      return NodesLocal.findOne({_id: this.params._id});
    }
  });
});
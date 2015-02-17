function getChildren () {
  if (! this.children) {
    return null;
  }

  var children = _.sortBy(this.children, "order");
  return _.map(children, function (child) {
    return Nodes.findOne(child._id);
  });
}

Template.node.helpers({
  indent: function () {
    return 20;
  },

  collapsed: function() {
    return this.collapsedBy &&
      this.collapsedBy[Meteor.userId()] === true;
  },

  getChildren: getChildren
});

Template.tree.helpers({
  getChildren: getChildren
});

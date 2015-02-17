function getChildren () {
  return this.children ? Nodes.find({
    _id: {$in: _.pluck(this.children, "_id")}
  }) : [];
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

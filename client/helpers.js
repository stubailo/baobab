function getChildren () {
  return this.children ? NodesLocal.find({
    _id: {$in: this.children}
  }) : [];
}

Template.node.helpers({
  indent: function () {
    return 20;
  },

  children: getChildren
});

Template.tree.helpers({
  children: getChildren
});

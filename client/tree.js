Template.tree.helpers({
  getRootChildren: function () {
    return this.children
      ? NodesLocal.find({
        _id: {$in: this.children}
      }) : []
  }
});

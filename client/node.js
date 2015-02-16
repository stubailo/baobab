Template.node.helpers({
  indent: function () {
    return 20;
  },
  children: function () {
    return this.children
      ? NodesLocal.find({_id: {$in: this.children}}) : []
  }
});
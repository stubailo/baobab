Template.node.helpers({
  indent: function () {
    return 20;
  },
  children: function () {
    return this.children ? Nodes.find({_id: {$in: this.children}}) : []
  }
});
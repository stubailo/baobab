Template.tree.helpers({
  rootNodes: function () {
    return Nodes.find({level: 0});
  }
});
Template.tree.helpers({
  rootNodes: function () {
    return NodesLocal.find({level: 0});
  }
});
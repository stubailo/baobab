Template.node.events({
  "click span.arrow": function(event, template) {
    var node = template.data;
    var collapsed = node.isCollapsedByCurrentUser();

    if (collapsed) {
      node.expand();
    } else {
      node.collapse();
    }

    return false;
  },
  "keydown input": function (event) {
    var node = this;

    if (event.which === 13) {
      Nodes.insertNode("", node.getParent()._id, node._id);
    }

    event.stopPropagation();
  }
});
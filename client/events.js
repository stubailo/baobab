Template.node.events({
  "click .arrow": function(event, template) {
    var node = template.data;
    var collapsed = node.isCollapsedByCurrentUser();

    if (collapsed) {
      node.expand();
    } else {
      node.collapse();
    }

    return false;
  },

  // TODONE Display the outline with a <ul>
  // TODO Support arrow keys.

  "keydown .input": function (event) {
    var node = this;
    if (event.which === 13) {
      if (! event.shiftKey) {
        Nodes.insertNode("", node.getParent()._id, node._id);
        // TODO Focus the new node.
        return false;
      }
    }
  }
});

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
    if (event.which === 13) {

    }
  }
});
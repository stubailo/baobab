Template.node.helpers({
  indent: function () {
    return 20;
  }
});

Template.body.helpers({
  contextMenu: function () {
    return Session.get("contextMenuNodeId");
  }
});

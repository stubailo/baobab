Template.node.helpers({
  indent: function () {
    return 20;
  },
  contextMenu: function () {
    return this._id === Session.get("contextMenuNodeId");
  }
});

Template.body.helpers({
  contextMenu: function () {
    return Session.get("contextMenuNodeId");
  }
});

Template.nodeContextMenu.helpers({
  position: function () {
    return {
      style: "top: " + Session.get("contextMenuPosition").top + "px; left: " +
        Session.get("contextMenuPosition").left + "px"
    };
  }
});
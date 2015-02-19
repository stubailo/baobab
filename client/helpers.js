Template.node.helpers({
  indent: function () {
    return 20;
  },

  contextMenu: function () {
    return this._id === Session.get("contextMenuNodeId");
  },

  getEditorDeindent: function() {
    var node = this;
    var root = Nodes.findOne(Session.get("rootNodeId"));
    var depth = 0;

    while (node && root && node._id !== root._id) {
      node = node.getParent();
      ++depth;
    }

    return -48 * depth;
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
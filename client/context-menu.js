Template.nodeContextMenu.events({
  "click .share": function () {
    Session.set("shareModalNodeId", Session.get("contextMenuNodeId"));
    Session.set("contextMenuNodeId", null);
  },
  "click .delete": function () {
    var node = Nodes.findOne(Session.get("contextMenuNodeId"));
    Session.set("contextMenuNodeId", null);

    Tracker.flush();

    var yes = confirm("Delete the bullet '" + node.content +
      "' and everything attached to it?");

    if (yes) {
      node.remove();
    }
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
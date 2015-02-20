Template.nodeContextMenu.events({
  "click .share": function () {
    Session.set("shareModalNodeId", Session.get("contextMenuNodeId"));
    Session.set("contextMenuNodeId", null);
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
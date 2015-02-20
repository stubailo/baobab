// The id of the node for which the share modal is currently open
Session.setDefault("shareModalNodeId", null);

Template.shareModal.helpers({
  shareModalOpen: function () {
    return Session.get("shareModalNodeId");
  },
  node: function () {
    return Nodes.findOne(Session.get("shareModalNodeId"));
  },
  isOwner: function () {
    return Template.parentData(1).owner === this.id;
  }
});

Template.shareModal.events({
  "click .share-modal-overlay, click .close": function () {
    Session.set("shareModalNodeId", null);
  },
  "submit form.share-to-user": function (event) {
    var username = event.target.username.value;
    var permission = event.target.permission.value;

    this.shareWithUsername(username, permission === "readWrite");

    return false;
  },
  "click .remove": function () {
    Nodes.findOne(this.nodeId).unshareFrom(this.userId);
  }
});
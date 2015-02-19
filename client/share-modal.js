// The id of the node for which the share modal is currently open
Session.setDefault("shareModalNodeId", null);

Template.shareModal.helpers({
  shareModalOpen: function () {
    return Session.get("shareModalNodeId");
  },
  node: function () {
    return Nodes.findOne(Session.get("shareModalNodeId"));
  }
});

Template.shareModal.events({
  "click .share-modal-overlay, click .close": function () {
    Session.set("shareModalNodeId", null);
  },
  "click .get-readonly-link": function () {
    this.generateShareUrl(false);
  },
  "click .get-readwrite-link": function () {
    this.generateShareUrl(true);
  }
});
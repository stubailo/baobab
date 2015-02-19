// These are all just method shells that call privileged functions from nodes.js

// authTokenOrUserId refers to a token or user ID used to confirm that the agent
// is authorized to perform this action
// identityUserId refers to an optional user ID used to identify the user that
// performed this action to display editing data and avatars
Meteor.methods({
  // Call Nodes.insertNode instead of calling this method directly.
  _insertNode: function (content, newID, parentNodeId, order) {
    NodeTrustedApi.insertNode(content, newID, parentNodeId, order, this.userId, this.userId);
  },

  removeNode: function (nodeId) {
    NodeTrustedApi.removeNode(nodeId, this.userId);
  },

  collapseNode: function (nodeId) {
    NodeTrustedApi.collapseNode(nodeId, this.userId, this.userId);
  },

  expandNode: function (nodeId) {
    NodeTrustedApi.expandNode(nodeId, this.userId, this.userId);
  },

  // XXX this operation is not atomic, subject to race conditions
  // XXX can be optimized to make fewer database queries
  moveNode: function (nodeId, newParentNodeId, previousNodeId) {
    NodeTrustedApi.moveNode(nodeId, newParentNodeId, previousNodeId, this.userId, this.userId);
  },

  updateNodeContent: function (nodeId, newContent) {
    NodeTrustedApi.updateNodeContent(nodeId, newContent, this.userId, this.userId);
  },

  // Only users can share things, share links can't re-share
  shareNode: function (nodeId, targetUserEmail, writeable) {
    NodeTrustedApi.shareNode(nodeId, targetUserEmail, writeable, userId);
  },

  shareNodeToPublicUrl: function (nodeId, token, writeable) {
    NodeTrustedApi.shareNodeToPublicUrl(nodeId, token, writeable, userId);
  }
});
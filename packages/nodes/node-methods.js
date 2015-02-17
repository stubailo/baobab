// These are all just method shells that call privileged functions from nodes.js
Meteor.methods({
  // Call Nodes.insertNode instead of calling this method directly.
  _insertNode: function (content, newID, parentNodeId, order) {
    NodeTrustedApi.insertNode(content, newID, parentNodeId, order, this.userId);
  },

  removeNode: function (nodeId) {
    NodeTrustedApi.removeNode(nodeId, this.userId);
  },

  collapseNode: function (nodeId) {
    NodeTrustedApi.collapseNode(nodeId, this.userId);
  },

  expandNode: function (nodeId) {
    NodeTrustedApi.expandNode(nodeId, this.userId);
  },

  // XXX this operation is not atomic, subject to race conditions
  // XXX can be optimized to make fewer database queries
  moveNode: function (nodeId, newParentNodeId, previousNodeId) {
    NodeTrustedApi.moveNode(nodeId, newParentNodeId, previousNodeId, this.userId);
  },

  updateNodeContent: function (nodeId, newContent) {
    NodeTrustedApi.updateNodeContent(nodeId, newContent, this.userId);
  }
});
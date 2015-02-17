// These functions only know how to run from trusted code, and take the
// user id as an argument

NodeTrustedApi = {
  insertNode: function (content, newId, parentNodeId, order, userId) {
    var parent;
    if (parentNodeId) {
      parent = Nodes.findOne(parentNodeId);
      if (! parent.isWriteableByUser(userId)) {
        throw new Meteor.Error("parent-permission-denied");
      }
    }

    var permissions = {
      readWrite: [userId],
      readOnly: []
    };

    if (parent) {
      permissions = parent.permissions;
    }

    var newNode = {
      _id: newId,
      content: content,
      children: [],
      createdBy: userId,
      updatedBy: [userId],
      createdAt: new Date(),
      updatedAt: new Date(),
      collapsedBy: {},
      permissions: permissions
    };

    check(newNode, Nodes.matchPattern);

    Nodes.insert(newNode);

    // All of the code below is for updating the parent, if this node doesn't
    // have a parent then return
    if (! parentNodeId) {
      return newId;
    }

    var newChild = {order: order, _id: newId};

    Nodes.update(parentNodeId, {$push: {children: newChild}});

    return newId;
  },
  removeNode: function (nodeId, userId) {
    check(nodeId, String);

    // Remove the node from the database
    var numRemoved = Nodes.remove({
      _id: nodeId,
      "permissions.readWrite": userId
    });

    // Technically, this error can happen for two reasons - the node doesn't
    // exist, or you don't have permission to remove it
    if (numRemoved === 0) {
      throw new Meteor.Error("remove-failed");
    }

    // Remove this node from the children array of its parent(s)
    Nodes.update({}, { $pull: { children: {_id: nodeId}}}, { multi: true });

    // Remove all of this node's children
    // XXX if we implement multiple parents, this code will delete too many
    // nodes sometimes
    var node = Nodes.findOne(nodeId);
    _.each(node.children, function (child) {
      Meteor.call("removeNode", child._id);
    });
  },
  collapseNode: function (nodeId, userId) {
    var fieldToSet = {};
    fieldToSet["collapsedBy." + userId] = true;

    Nodes.update(nodeId, {$set: fieldToSet});
  },
  expandNode: function (nodeId, userId) {
    var fieldToUnset = {};
    // In mongo, we need to make a dictionary with the keys that we want to
    // unset
    fieldToUnset["collapsedBy." + userId] = true;

    Nodes.update(nodeId, {$unset: fieldToUnset});
  },
  updateNodeContent: function (nodeId, newContent, userId) {
    check(newContent, String);

    var updated = Nodes.update({
      _id: nodeId,
      "permissions.readWrite": userId
    }, {
      $set: {
        content: newContent,
        updatedAt: new Date()
      },
      $addToSet: {
        updatedBy: userId
      }
    });

    if (updated === 0) {
      throw new Meteor.Error("permission-denied");
    }
  },
  moveNode: function (nodeId, newParentNodeId, previousNodeId, userId) {
    check(nodeId, String);
    check(newParentNodeId, String);
    check(previousNodeId, Match.Optional(String));

    if (nodeId === previousNodeId) {
      throw new Meteor.Error("node-same-as-previous-node");
    }

    if (nodeId === newParentNodeId) {
      throw new Meteor.Error("node-same-as-new-parent-node");
    }

    // Iterate up the ancestor chain from newParentNode to make sure nodeId is
    // not one of its ancestors. Otherwise, we would end up with a closed cycle.
    // XXX if you have multiple parents, this check becomes very hard
    var pointer = newParentNodeId;
    var tempParent;

    // Run this loop until we break because we didn't find a parent so we are at
    // the top of the tree
    while (true) {
      tempParent = Nodes.findOne({ "children._id": pointer });

      if (tempParent) {
        pointer = tempParent._id;
        if (pointer === nodeId) {
          // One of the new parent's ancestors is the node we are trying to move
          throw new Meteor.Error("cycle-not-allowed");
        }
      } else {
        // We reached the end
        break;
      }
    }

    // Make sure we have permissions to write to both the new parent and
    // the node we are moving
    var node = Nodes.findOne(nodeId);
    if (! node.isWriteableByUser(userId)) {
      throw new Meteor.Error("node-permission-denied");
    }

    var parent = node.getParent();
    if (! parent.isWriteableByUser(userId)) {
      throw new Meteor.Error("parent-permission-denied");
    }

    var newNodeOrder = calculateNodeOrder(newParentNodeId, previousNodeId);

    // Remove this node from the children array of its parent(s)
    // XXX if we implement multiple parents, this code will remove all of the
    // references
    Nodes.update({}, { $pull: { children: {_id: nodeId}}}, { multi: true });

    // Add this node to the children array of its new parent
    Nodes.update(newParentNodeId, {
      $push: {
        children: { _id: nodeId, order: newNodeOrder }
      }
    });
  },
  shareNode: function (nodeId, targetUserId, writeable, userId) {
    check(nodeId, String);
    check(targetUserId, String);
    check(writeable, Boolean);
    check(userId, String);

    var node = Nodes.findOne(nodeId);
    var numUpdated;

    if (writeable) {
      numUpdated = Nodes.update({
        _id:nodeId,
        "permissions.readWrite": userId
      }, {$addToSet: {
        "permissions.readWrite": targetUserId
      } });

      if (numUpdated === 0) {
        throw new Meteor.Error("writeable-sharing-denied");
      }
    } else {
      numUpdated = Nodes.update({
        _id:nodeId,
        "permissions.readOnly": userId
      }, {$addToSet: {
        "permissions.readOnly": targetUserId
      } });

      if (numUpdated === 0) {
        throw new Meteor.Error("readable-sharing-denied");
      }
    }

    _.each(node.children, function (child) {
      NodeTrustedApi.shareNode(child._id, targetUserId, writeable, userId);
    });
  }
};
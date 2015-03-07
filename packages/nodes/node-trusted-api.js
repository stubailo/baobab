// These functions only know how to run from trusted code, and take the
// user id as an argument

var applyToNodeRecusively = function (node, modifier) {
  Nodes.update(node._id, modifier);

  _.each(node.children, function (child) {
    applyToNodeRecusively(Nodes.findOne(child._id), modifier);
  });
};

// Like _.difference, but knows how to deal with permissions objects
// O(n) implementation by making a dictionary out of unique keys
var permDifference = function (left, right) {
  var dictionaryOfRight = {};

  _.each(right, function (perm) {
    dictionaryOfRight[perm.id + perm.date] = perm;
  });

  return _.filter(left, function (perm) {
    return ! _.has(dictionaryOfRight, perm.id + perm.date);
  });
};

NodeTrustedApi = {
  insertLink: function (linkTarget, newId, parentNodeId, order, userId) {
    if (! parentNodeId) {
      throw new Error("link needs parent");
    }

    var parent = Nodes.findOne(parentNodeId);
    if (! parent.isWriteableByUser(userId)) {
      throw new Meteor.Error("parent-permission-denied");
    }

    var permissions = NodeTrustedApi._markPermissionsInherited(parent.permissions);

    var user = Meteor.users.findOne(userId);
    var owner = parent.owner;

    var newNode = {
      _id: newId,
      content: null,
      children: [],
      createdBy: {
        _id: user._id,
        username: user.username
      },
      lastUpdatedBy: {
        _id: user._id,
        username: user.username
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      collapsedBy: {},
      permissions: permissions,
      lockedBy: null,
      owner: owner,

      // the actual link target
      link: linkTarget
    };

    check(newNode, Nodes.matchPattern);

    Nodes.insert(newNode);

    var newChild = {order: order, _id: newId};
    Nodes.update(parentNodeId, {$push: {children: newChild}});

    return newId;
  },
  insertRootNode: function(newId, userId, username) {
    var permissions = {
      readWrite: [{
        date: new Date(),
        id: userId,
        inherited: false,
        username: username
      }],
      readOnly: []
    };

    var user;
    if (username) {
      user = {
        username: username,
        _id: userId
      };
    } else {
      user = Meteor.users.findOne(userId);
    }

    var owner = userId;

    var newNode = {
      _id: newId,
      content: null,
      children: [],
      createdBy: {
        _id: user._id,
        username: user.username
      },
      lastUpdatedBy: {
        _id: user._id,
        username: user.username
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      collapsedBy: {},
      permissions: permissions,
      lockedBy: null,
      owner: owner
    };

    check(newNode, Nodes.matchPattern);
    Nodes.insert(newNode);

    return newId;
  },

  insertNode: function (content, newId, parentNodeId, order, userId, username) {
    var parent = Nodes.findOne(parentNodeId);
    if (! parent.isWriteableByUser(userId)) {
      throw new Meteor.Error("parent-permission-denied");
    }

    var permissions = NodeTrustedApi._markPermissionsInherited(parent.permissions);

    var user;
    if (username) {
      user = {
        username: username,
        _id: userId
      };
    } else {
      user = Meteor.users.findOne(userId);
    }

    var owner = parent.owner;

    var newNode = {
      _id: newId,
      content: content,
      children: [],
      createdBy: {
        _id: user._id,
        username: user.username
      },
      lastUpdatedBy: {
        _id: user._id,
        username: user.username
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      collapsedBy: {},
      permissions: permissions,
      lockedBy: null,
      owner: owner
    };

    check(newNode, Nodes.matchPattern);

    Nodes.insert(newNode);

    // update the parent
    var newChild = {order: order, _id: newId};
    Nodes.update(parentNodeId, {$push: {children: newChild}});

    return newId;
  },
  removeNode: function (nodeId, userId) {
    check(nodeId, String);
    check(userId, String);

    var node = Nodes.findOne(nodeId);

    // Remove the node from the database
    var numRemoved = Nodes.remove({
      _id: nodeId,
      "permissions.readWrite.id": userId
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
    _.each(node.children, function (child) {
      NodeTrustedApi.removeNode(child._id, userId);
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

    var user = Meteor.users.findOne(userId);

    var now = new Date;
    var updated = Nodes.update({
      _id: nodeId,
      "permissions.readWrite.id": userId,
      $or: [{
          lockedBy: {$in: [userId, null]}
        }, {
          updatedAt: {$lt: (new Date - Settings.lockDuration)}
      }]
    }, {
      $set: {
        content: newContent,
        updatedAt: now,
        lockedBy: userId,
        lastUpdatedBy: {
          _id: user._id,
          username: user.username
        }
      }
    });

    if (updated === 0) {
      throw new Meteor.Error("locked-or-permission-denied");
    } else {
      if (Meteor.isServer) {
        Meteor.setTimeout(function () {
          NodeTrustedApi.unlockNode(nodeId, now);
        }, Settings.lockDuration);
      }
    }
  },
  moveNode: function (nodeId, newParentNodeId, previousNodeId, userId) {
    check(nodeId, String);
    check(newParentNodeId, String);
    check(previousNodeId, Match.Optional(Match.OneOf(String, null)));
    check(userId, String);

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

    if (newParentNodeId !== parent._id) {
      // If we are moving this node to a different subtree, there might be
      // different permissions there, so we have to update the inherited
      // permissions of the node we are moving

      var newParent = Nodes.findOne(newParentNodeId);

      var newParentPerms = NodeTrustedApi._markPermissionsInherited(newParent.getField("permissions"));
      var oldParentPerms = NodeTrustedApi._markPermissionsInherited(parent.getField("permissions"));

      if (! _.isEqual(newParentPerms, oldParentPerms)) {
        // The permissions are in fact different, so we have to update the whole
        // subtree under the node being moved with the new inherited permissions

        // First, take all of the permissions of the new parent
        var inheritedPerms = {
          readOnly: _.where(node.permissions.readOnly, {inherited: true}),
          readWrite: _.where(node.permissions.readWrite, {inherited: true})
        };

        var readOnlyPermsToAdd = permDifference(newParentPerms.readOnly,
          inheritedPerms.readOnly);
        var readWritePermsToAdd = permDifference(newParentPerms.readWrite,
          inheritedPerms.readWrite);

        var readOnlyPermsToRemove = permDifference(inheritedPerms.readOnly,
          newParentPerms.readOnly);
        var readWritePermsToRemove = permDifference(inheritedPerms.readWrite,
          newParentPerms.readWrite);

        // this is the modifier that we need to apply to this node and all
        // of its children recursively to fix up the permissions
        var pushModifier = {
          $pushAll: {},
          $set: {
            owner: newParent.owner
          }
        };

        if (! _.isEmpty(readOnlyPermsToAdd)) {
          pushModifier.$pushAll["permissions.readOnly"] = readOnlyPermsToAdd;
        }

        if (! _.isEmpty(readWritePermsToAdd)) {
          pushModifier.$pushAll["permissions.readWrite"] = readWritePermsToAdd;
        }

        if (_.isEmpty(pushModifier.$pushAll)) {
          delete pushModifier["$pushAll"];
        }

        // We can't both pull and push in the same operation due to a mongo
        // limitation
        var pullModifier = {
          $pullAll: {}
        };

        if (! _.isEmpty(readOnlyPermsToRemove)) {
          pullModifier.$pullAll["permissions.readOnly"] = readOnlyPermsToRemove;
        }

        if (! _.isEmpty(readWritePermsToRemove)) {
          pullModifier.$pullAll["permissions.readWrite"] = readWritePermsToRemove;
        }

        // Pull the trigger
        applyToNodeRecusively(node, pushModifier);
        applyToNodeRecusively(node, pullModifier);
      }
    }

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

  shareNode: function (nodeId, targetUsername, writeable, userId) {
    check(nodeId, String);
    check(targetUsername, String);
    check(writeable, Boolean);
    check(userId, String);

    var targetUser = Meteor.users.findOne({
      username: targetUsername
    });

    if (! targetUser) {
      throw new Meteor.Error("user-not-found");
    }

    var permissionToken = {
      id: targetUser._id,
      date: new Date(),
      inherited: false,
      username: targetUsername
    };

    var targetUserId = permissionToken.id;
    var shareTargetRootNode = Meteor.users.findOne(targetUserId).rootNodeId;
    var order = calculateNodeOrder(shareTargetRootNode);

    NodeTrustedApi.insertLink(nodeId, Random.id(), shareTargetRootNode, order, targetUserId);

    NodeTrustedApi._shareNodeToId(nodeId, permissionToken, writeable, userId);
  },

  _shareNodeToId: function (nodeId, permissionToken, writeable, userId) {
    var node = Nodes.findOne(nodeId);
    var numUpdated;

    if (_.findWhere(node.permissions.readOnly, {id: permissionToken.id}) ||
      _.findWhere(node.permissions.readWrite, {id: permissionToken.id})) {
      NodeTrustedApi.unshareNode(nodeId, permissionToken.id, userId);
    }

    if (writeable) {
      numUpdated = Nodes.update({
        _id:nodeId,
        "permissions.readWrite.id": userId
      }, {$addToSet: {
        "permissions.readWrite": permissionToken
      } });

      if (numUpdated === 0) {
        throw new Meteor.Error("writeable-sharing-denied");
      }
    } else {
      numUpdated = Nodes.update({
        _id:nodeId,
        $or: [
          {"permissions.readOnly.id": userId},
          {"permissions.readWrite.id": userId}
        ]
      }, {$addToSet: {
        "permissions.readOnly": permissionToken
      } });

      if (numUpdated === 0) {
        throw new Meteor.Error("readable-sharing-denied");
      }
    }

    _.each(node.children, function (child) {
      // All children get inherited permissions from this node
      permissionToken.inherited = true;
      NodeTrustedApi._shareNodeToId(child._id, permissionToken, writeable, userId);
    });
  },

  unshareNode: function (nodeId, targetUserId, userId) {
    check(nodeId, String);
    check(targetUserId, String);
    check(userId, String);

    var node = Nodes.findOne(nodeId);

    var linkNode = Nodes.findOne({link: nodeId, owner: targetUserId});
    if (linkNode) {
      NodeTrustedApi.removeNode(linkNode._id, targetUserId);
    }

    numUpdated = Nodes.update({
      _id: nodeId,
      "permissions.readWrite.id": userId,
      owner: { $ne: targetUserId }
    }, {
      $pull: {
        "permissions.readOnly": { id: targetUserId },
        "permissions.readWrite": { id: targetUserId }
      }
    });

    if (numUpdated === 0) {
      throw new Meteor.Error("permission-denied");
    }

    _.each(node.children, function (child) {
      NodeTrustedApi.unshareNode(child._id, targetUserId, userId);
    });
  },

  _markPermissionsInherited: function (permissionsField) {
    var makeInheritedTrue = function (perm) {
      perm.inherited = true;
      return perm;
    };

    // Set inherited to true on all permissions
    permissionsField.readWrite = _.map(permissionsField.readWrite, makeInheritedTrue);
    permissionsField.readOnly = _.map(permissionsField.readOnly, makeInheritedTrue);

    return permissionsField;
  },

  unlockNode: function (nodeId, when) {
    // unlock only if the time passed in matches (otherwise, the user updated again
    // more recently, and we should wait for the last unlock call.) Can only be called from server
    Nodes.update({
      _id: nodeId,
      updatedAt: when
    }, {
      $set: {lockedBy: null}
    });
  } ,

  releaseOwnNodeLock: function (nodeId, userId) {
    // the client can release its own lock (usually on leaving the node)
    Nodes.update({
      _id: nodeId,
      lockedBy: userId
    }, {
      $set: {lockedBy: null}
    });
  },

  setNodeCursorPresent: function (nodeId, userId, username) {
    Nodes.update({
      _id: nodeId
    }, {
      $set: {
        cursorPresent: {
          userId: userId,
          username: username
        }
      }
    });
    // XXX should probably cancel redundant cursor clears - right now
    // they all trigger even if no longer relevant.
    if (Meteor.isServer) {
      Meteor.setTimeout(function () {
        NodeTrustedApi.setNodeCursorPresent(nodeId, null, '');
      }, Settings.cursorPresentDuration);
    }

  }
};
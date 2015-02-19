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
    dictionaryOfRight[perm.userId + perm.token + perm.date] = perm;
  });

  return _.filter(left, function (perm) {
    return ! _.has(dictionaryOfRight, perm.userId + perm.token + perm.date);
  });
};

NodeTrustedApi = {
  insertNode: function (content, newId, parentNodeId, order, userId) {
    var parent;
    if (parentNodeId) {
      parent = Nodes.findOne(parentNodeId);
      if (! parent.isWriteableByUser(userId)) {
        throw new Meteor.Error("parent-permission-denied");
      }
    }

    var permissions;
    if (parent) {
      permissions = NodeTrustedApi._markPermissionsInherited(parent.permissions);
    } else {
      permissions = [{
        date: new Date(),
        userId: userId,
        inherited: false,
        read: true,
        write: true,
        owner: true,
        givenBy: userId
      }];
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

  removeNode: function (nodeId, auth) {
    check(nodeId, String);
    check(auth, {
      userId: Match.Optional(String),
      token: Match.Optional(String)
    });

    var node = Nodes.findOne(nodeId);

    var permQuery = { write: true };
    if (auth.userId) {
      permQuery.userId = auth.userId;
    } else if (auth.token) {
      permQuery.token = auth.token;
    } else {
      throw new Error("need userId or token");
    }

    // Remove the node from the database
    var numRemoved = Nodes.remove({
      _id: nodeId,
      permissions: {
        $elemMatch: permQuery
      }
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
      NodeTrustedApi.removeNode(child._id, auth);
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
      "permissions.readWrite.id": userId
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

      if (! _.isEqual(newParent.permissions, parent.permissions)) {
        // The permissions are in fact different, so we have to update the whole
        // subtree under the node being moved with the new inherited permissions
        
        // First, take all of the permissions of the new parent
        var newParentPerms = NodeTrustedApi._markPermissionsInherited(newParent.permissions);
        var inheritedPerms = _.where(node.permissions, {inherited: true});

        var permsToAdd = permDifference(newParentPerms, inheritedPerms);
        var permsToRemove = permDifference(inheritedPerms, newParentPerms);

        // this is the modifier that we need to apply to this node and all
        // of its children recursively to fix up the permissions
        var pushModifier = {
          $pushAll: {
            permissions: permsToAdd
          }
        };

        // We can't both pull and push in the same operation due to a mongo
        // limitation
        var pullModifier = {
          $pullAll: {
            permissions: permsToRemove
          }
        };

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

  shareNode: function (nodeId, targetUserEmail, writeable, userId) {
    check(nodeId, String);
    check(targetUserEmail, String);
    check(writeable, Boolean);
    check(userId, String);

    var targetUser = Meteor.users.findOne({
      "emails.address": targetUserEmail
    });

    var targetUserId;
    if (targetUser) {
      targetUserId = targetUser._id;
    } else {
      if (Meteor.isClient) {
        // We can't simulate sending an email
        return;
      }

      // If we are trying to share with someone who doesn't have an account yet,
      // then create the user and send them an enrollment email.
      targetUserId = Accounts.createUser({
        email: targetUserEmail,
        password: Random.id()
      });

      Accounts.sendEnrollmentEmail(targetUserId);
    }

    var permissionToken = {
      id: targetUserId,
      type: "user",
      date: new Date(),
      inherited: false
    };

    NodeTrustedApi._shareNodeToId(nodeId, permissionToken, writeable, userId);
  },

  shareNodeToPublicUrl: function (nodeId, token, writeable, userId) {
    check(nodeId, String);
    check(token, String);
    check(writeable, Boolean);
    check(userId, String);

    var permissionToken = {
      token: token,
      date: new Date(),
      inherited: false,
      read: true,
      owner: false,
      write: writeable,
      givenBy: userId
    };

    NodeTrustedApi._shareNodeToId(nodeId, permissionToken, userId);
  },

  _shareNodeToId: function (nodeId, permissionToken, userId) {
    check(permissionToken, Nodes.permissionMatchPattern);

    var node = Nodes.findOne(nodeId);
    var numUpdated;

    if (permissionToken.level === "readWrite") {
      numUpdated = Nodes.update({
        _id: nodeId,
        permissions: {
          $elemMatch: {
            userId: userId,
            write: true
          }
        }
      }, { $addToSet: {
        permissions: permissionToken
      } });

      if (numUpdated === 0) {
        throw new Meteor.Error("writeable-sharing-denied");
      }
    } else {
      numUpdated = Nodes.update({
        _id: nodeId,
        permissions: {
          $elemMatch: {
            userId: userId,
            read: true
          }
        }
      }, {$addToSet: {
        permissions: permissionToken
      } });

      if (numUpdated === 0) {
        throw new Meteor.Error("readable-sharing-denied");
      }
    }

    _.each(node.children, function (child) {
      // All children get inherited permissions from this node
      permissionToken.inherited = true;
      NodeTrustedApi._shareNodeToId(child._id, permissionToken, userId);
    });
  },

  _markPermissionsInherited: function (permissionsField) {
    var makeInheritedTrue = function (perm) {
      perm.inherited = true;
      return perm;
    };

    // Set inherited to true on all permissions
    return _.map(permissionsField, makeInheritedTrue);
  }
};
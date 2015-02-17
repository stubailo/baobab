Nodes = new Mongo.Collection("nodes");

/**
 * Figure out what the order key needs to be to place an element inside a
 * parent node so that it is right before beforeNode. If beforeNodeId is not
 * passed, generates an order key that is after everything in the list of
 * children.
 * @param  {String} parentNodeId The id of the parent node
 * @param  {String} beforeNodeId The id of the node that should be right after
 * the new node; optional if you want to place it at the end of the children
 * @return {Number}              The order key that will place the new node in
 * the desired place among the children
 */
var calculateNodeOrder = function (parentNodeId, beforeNodeId) {
  if (! parentNodeId) {
    // We are creating the root node, so we don't really care what the order is
    return 0;
  }

  var parent = Nodes.findOne(parentNodeId);

  if (! parent) {
    throw new Meteor.Error("parent-node-not-found");
  }

  if (parentNodeId === beforeNodeId) {
    throw new Meteor.Error("parent-node-same-as-before-node");
  }

  if (beforeNodeId && ! _.findWhere(parent.children, {_id: beforeNodeId})) {
    throw new Meteor.Error("before-node-not-in-parent");
  }

  var siblings = _.sortBy(parent.children, "order");

  if (siblings.length === 0) {
    // This is the first child of this parent, so give it any order, 0 is
    // convenient
    return 0;
  }

  // If we want to put an item at the very end or very beginning of the list, we
  // need to add a random number to the order key of the last or first item, so
  // that when two people simultaneously add items to the same end they don't
  // end up with the same order key.
  var randomNumberGreaterThanOne = Random.fraction() + 1;

  // Now we are sure that siblings.length > 0, meaning the parent node has at
  // least one child
  if (! beforeNodeId) {
    // Just append it to the end
    return _.last(siblings).order + randomNumberGreaterThanOne;
  }

  // Find the child specified by beforeNodeId
  var beforeSiblingOrder, beforeSiblingIndex = -1;
  for (var i = 0; i < siblings.length; i++) {
    if (siblings[i]._id === beforeNodeId) {
      beforeSiblingIndex = i;
      beforeSiblingOrder = siblings[i].order;
    }
  }

  if (beforeSiblingIndex === 0) {
    // We are trying to insert before the first child
    return beforeSiblingOrder - randomNumberGreaterThanOne;
  }

  // At this point, we are in the most complex case - we need to insert a new
  // child between two existing children.
  var afterSiblingIndex = beforeSiblingIndex - 1;
  var afterSiblingOrder = siblings[afterSiblingIndex].order;

  // We need to generate a random number here so that we don't end up with
  // identical order fields on two nodes inserted between two existing nodes
  // at the same time. This random number needs to be smaller than the
  // difference in the order keys
  var distance = afterSiblingOrder - beforeSiblingOrder;
  var randomNumberSmallerThanDistance = Random.fraction() * distance / 2 +
    distance / 4;

  return beforeSiblingOrder + randomNumberSmallerThanDistance;
};

// We need this function so that the order is only generated on the client. If
// you called the method directly, the order would be generated on the server.
// 
// The order needs to be generated on the client to avoid UI flickering from
// different orders being generated on the client and server
Nodes.insertNode = function (content, parentNodeId, beforeNodeId) {
  var newNodeOrder = calculateNodeOrder(parentNodeId, beforeNodeId);
  var newID = Random.id();
  return Meteor.call("_insertNode", content, newID, parentNodeId, newNodeOrder);
};

Meteor.methods({
  // Call Nodes.insertNode instead
  _insertNode: function (content, newID, parentNodeId, order) {
    var newNode = {
      _id: newID,
      content: content,
      children: [],
      createdBy: this.userId,
      updatedBy: [this.userId],
      createdAt: new Date(),
      updatedAt: new Date(),
      collapsedBy: {}
    };

    check(newNode, Nodes.matchPattern);

    Nodes.insert(newNode);

    // All of the code below is for updating the parent, if this node doesn't
    // have a parent then return
    if (! parentNodeId) {
      return newID;
    }

    var newChild = {order: order, _id: newID};

    Nodes.update(parentNodeId, {$push: {children: newChild}});

    return newID;
  },

  removeNode: function (nodeId) {
    check(nodeId, String);

    // Remove this node from the children array of its parent(s)
    Nodes.update({}, { $pull: { children: {_id: nodeId}}}, { multi: true });

    // Remove all of this node's children
    // XXX if we implement multiple parents, this code will delete too many
    // nodes sometimes
    var node = Nodes.findOne(nodeId);
    _.each(node.children, function (child) {
      Meteor.call("removeNode", child._id);
    });

    // Remove the node from the database
    Nodes.remove(nodeId);
  },

  collapseNode: function (nodeId) {
    var fieldToSet = {};
    fieldToSet["collapsedBy." + this.userId] = true;

    Nodes.update(nodeId, {$set: fieldToSet});
  },

  unCollapseNode: function (nodeId) {
    var fieldToUnset = {};
    // In mongo, we need to make a dictionary with the keys that we want to
    // unset
    fieldToUnset["collapsedBy." + this.userId] = true;

    Nodes.update(nodeId, {$unset: fieldToUnset});
  },

  moveNode: function (nodeId, newParentNodeId, beforeNodeId) {
    check(nodeId, String);
    check(newParentNodeId, String);
    check(beforeNodeId, Match.Optional(String));

    if (nodeId === beforeNodeId) {
      throw new Meteor.Error("node-same-as-before-node");
    }

    if (nodeId === newParentNodeId) {
      throw new Meteor.Error("node-same-as-new-parent-node");
    }

    // Iterate up the ancestor chain from newParentNode to make sure nodeId is
    // not one of its ancestors. Otherwise, we would end up with a closed cycle.
    // XXX if you have multiple parents, this check becomes very hard
    var pointer = newParentNodeId;
    var parent;

    // Run this loop until we break because we didn't find a parent so we are at
    // the top of the tree
    while (true) {
      parent = Nodes.findOne({ "children._id": pointer });

      if (parent) {
        pointer = parent._id;
        if (pointer === nodeId) {
          // One of the new parent's ancestors is the node we are trying to move
          throw new Meteor.Error("cycle-not-allowed");
        }
      } else {
        // We reached the end
        break;
      }
    }

    var newNodeOrder = calculateNodeOrder(newParentNodeId, beforeNodeId);

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

  updateNodeContent: function (nodeId, newContent) {
    check(newContent, String);

    Nodes.update(nodeId, {
      $set: {
        content: newContent,
        updatedAt: new Date()
      },
      $addToSet: {
        updatedBy: this.userId
      }
    });
  }
});

Nodes.matchPattern = {
  _id: String,

  // The ids of the child nodes, and the order key that should be sorted by
  children: [{_id: String, order: Number}],

  // The contents of this node
  content: Match.Optional(String),

  // The time this node was first created
  createdAt: Date,

  // The time this node was last updated
  updatedAt: Date,

  // The user id who first created this node
  createdBy: String,

  // A list of all user ids that have ever edited this node
  updatedBy: [String],

  // The user who is currently editing this node, locking it
  lockedBy: Match.Optional(String),

  // An object where the keys are user ids and the value is true if they have
  // collapsed this node
  collapsedBy: Object
};

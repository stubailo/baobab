Nodes = new Mongo.Collection("nodes");

var calculateNodeOrder = function (parentNodeId, beforeNodeId) {
  var parent = Nodes.findOne(parentNodeId);
  var siblings = _.sortBy(parent.children, "order");

  var newNodeOrder;
  if (siblings.length === 0) {
    newNodeOrder = 0;
  } else if (siblings.length === 1) {
    var existingNode = siblings[0];

    if (beforeNodeId === existingNode._id) {
      newNodeOrder = existingNode.order - 1;
    } else {
      // If beforeNodeId is undefined, we will get here and the new node
      // will become the last one in the list
      newNodeOrder = existingNode.order + 1;
    }
  } else if (siblings.length > 1) {
    if (! beforeNodeId) {
      // Just append it to the end
      newNodeOrder = _.last(siblings).order + 1;
    } else {
      var afterSiblingOrder, afterSiblingIndex;
      for (var i = 0; i < siblings.length; i++) {
        if (siblings[i]._id === beforeNodeId) {
          afterSiblingIndex = i;
          afterSiblingOrder = siblings[i].order;
        }
      }

      var beforeSiblingIndex = afterSiblingIndex - 1;
      var beforeSiblingOrder = siblings[beforeSiblingIndex].order;

      // We need to generate a random number here so that we don't end up with
      // identical order fields on two nodes inserted between two existing nodes
      // at the same time. This random number needs to be smaller than the
      // difference in the order keys
      var distance = afterSiblingOrder - beforeSiblingOrder;
      var randomNumberSmallerThanDistance = Random.fraction() * distance / 2 +
        distance / 4;

      newNodeOrder = beforeSiblingOrder + randomNumberSmallerThanDistance;
    }
  } else {
    throw new Error("we missed a case here");
  }

  return newNodeOrder;
};

Nodes.insertEmptyNode = function (parentNodeId, beforeNodeId) {
  var newNodeOrder = calculateNodeOrder(parentNodeId, beforeNodeId);

  Meteor.call("_insertEmptyNode", parentNodeId, newNodeOrder);
};

Meteor.methods({
  // Call Nodes.insertEmptyNode instead
  _insertEmptyNode: function (parentNodeId, order) {
    var id = Nodes.insert({
      content: "",
      createdBy: this.userId,
      updatedBy: [this.userId]
    });

    // All of the code below is for updating the parent, if this node doesn't
    // have a parent then return
    if (! parentNodeId) {
      return;
    }

    var newChild = {order: order, _id: id};

    Nodes.update(parentNodeId, {$push: {children: newChild}});

    return id;
  },
  collapseNode: function (nodeId) {
    if (! this.userId) {
      throw new Meteor.Error("must-be-logged-in");
    }

    var fieldToSet = {};
    fieldToSet["collapsedBy." + this.userId] = true;

    Meteor.update(nodeId, {$set: fieldToSet});
  },
  unCollapseNode: function (nodeId) {
    if (! this.userId) {
      throw new Meteor.Error("must-be-logged-in");
    }

    var fieldToUnset = {};
    // In mongo, we need to make a dictionary with the keys that we want to
    // unset
    fieldToUnset["collapsedBy." + this.userId] = true;

    Meteor.update(nodeId, {$unset: fieldToUnset});
  }
});

Nodes.matchPattern = {
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
  lockedBy: String,

  // An object where the keys are user ids and the value is true if they have
  // collapsed this node
  collapsedBy: Object
};

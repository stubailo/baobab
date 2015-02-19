Nodes = new Mongo.Collection("nodes", {
  transform: function (nodeDocument) {
    return new NodeModel(nodeDocument);
  }
});

/**
 * Figure out what the order key needs to be to place an element inside a
 * parent node so that it is right after previousNode. If previousNodeId is not
 * passed, generates an order key that is before everything in the list of
 * children.
 * @param  {String} parentNodeId The id of the parent node
 * @param  {String} previousNodeId The id of the node that should be right after
 * the new node; optional if you want to place it at the end of the children
 * @return {Number}              The order key that will place the new node in
 * the desired place among the children
 */
calculateNodeOrder = function (parentNodeId, previousNodeId) {
  if (! parentNodeId) {
    // We are creating the root node, so we don't really care what the order is
    return 0;
  }

  var parent = Nodes.findOne(parentNodeId);

  if (! parent) {
    throw new Meteor.Error("parent-node-not-found");
  }

  if (parentNodeId === previousNodeId) {
    throw new Meteor.Error("parent-node-same-as-previous-node");
  }

  if (previousNodeId && ! _.findWhere(parent.children, {_id: previousNodeId})) {
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
  if (! previousNodeId) {
    // Just append it to the end
    return _.first(siblings).order - randomNumberGreaterThanOne;
  }

  // Find the child specified by previousNodeId
  var previousSiblingOrder, previousSiblingIndex = -1;
  for (var i = 0; i < siblings.length; i++) {
    if (siblings[i]._id === previousNodeId) {
      previousSiblingIndex = i;
      previousSiblingOrder = siblings[i].order;
    }
  }

  if (previousSiblingIndex === siblings.length - 1) {
    // We are trying to insert before the first child
    return previousSiblingOrder + randomNumberGreaterThanOne;
  }

  // At this point, we are in the most complex case - we need to insert a new
  // child between two existing children.
  var nextSiblingIndex = previousSiblingIndex + 1;
  var nextSiblingOrder = siblings[nextSiblingIndex].order;

  // We need to generate a random number here so that we don't end up with
  // identical order fields on two nodes inserted between two existing nodes
  // at the same time. This random number needs to be smaller than the
  // difference in the order keys
  var distance = nextSiblingOrder - previousSiblingOrder;
  var randomNumberSmallerThanDistance = Random.fraction() * distance / 2 +
    distance / 4;

  return previousSiblingOrder + randomNumberSmallerThanDistance;
};

// We need this function so that the order is only generated on the client. If
// you called the method directly, the order would be generated on the server.
// 
// The order needs to be generated on the client to avoid UI flickering from
// different orders being generated on the client and server
Nodes.insertNode = function (content, parentNodeId, previousNodeId) {
  var newNodeOrder = calculateNodeOrder(parentNodeId, previousNodeId);
  var newID = Random.id();
  Meteor.call("_insertNode", content, newID, parentNodeId, newNodeOrder);
  return newID;
};

Nodes.matchPattern = {
  _id: String,

  // The ids of the child nodes, and the order key that should be sorted by
  children: [{_id: String, order: Number}],

  // The contents of this node
  content: Match.OneOf(String, null),

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
  collapsedBy: Object,

  permissions: {
    readOnly: [{
      id: String,
      date: Date,
      type: Match.OneOf("user", "token"),
      inherited: Boolean
    }],
    readWrite: [{
      id: String,
      date: Date,
      type: Match.OneOf("user", "token"),
      inherited: Boolean
    }]
  }
};

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
  }
});

NodeSchema = new SimpleSchema({

  // When displaying this node in a list of children, sort by this value
  // XXX it's possible that if we move nodes around a lot, this will exceed
  // the precision of JavaScript numbers. we won't care for now, but we might
  // have to do something about it in the future.

  // The ids and orders of the node that are children of this node
  children: {
    type: [Object],
    defaultValue: [],
    custom: function() {
    }
  },

  // The content of this node
  content: {
    type: String,
    optional: true // Otherwise, it doesn't allow empty strings
  },

  createdAt: {
    type: Date,
    autoValue: function () {
      if (this.isInsert) {
        return new Date();
      } else if (this.isUpsert) {
        return {
          $setOnInsert: new Date()
        };
      } else {
        this.unset();
      }
    }
  },

  updatedAt: {
    type: Date,
    autoValue: function () {
      return new Date();
    }
  },

  // The user that first created this node
  createdBy: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
    denyUpdate: true,
    autoValue: function () {
      if (this.isInsert) {
        if (this.isFromTrustedCode) {
          return this.value;
        } else {
          return this.userId;
        }
      } else {
        this.unset();
      }
    }
  },

  // A list of all of the users that have edited this node. When the node is
  // created, this is an array with the user who created it.
  updatedBy: {
    // For some reason, these schema fields still allow an array with null
    // values, so we have a custom validation function
    // XXX submit a bug on simpleschema for this
    type: [String],
    regEx: SimpleSchema.RegEx.Id,
    autoValue: function () {
      var userId;

      if (! this.userId && ! this.value) {
        return;
      }

      if (! this.userId) {
        // When you call this from trusted code, the argument passed in will
        // be an array
        userId = this.value[0];
      } else {
        userId = this.userId;
      }

      if (this.isInsert) {
        return [userId];
      } else {
        return {
          $addToSet: userId
        };
      }
    },
    custom: function () {
      var value = this.value;

      if (! _.isArray(value)) {
        return "expectedArray";
      }

      if (value.length < 1) {
        return "minCount";
      }

      if (! _.all(value, function (item) {
        return _.isString(item);
      })) {
        return "expectedString";
      }
    }
  },

  // The user that is currently editing this node, if any. If nobody is
  // currently editing this node, this value will be null.
  lockedBy: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
    optional: true
  },

  // An object where the keys are user ids and the value is true. The keys
  // are the users that have this bullet point collapsed in their view.
  collapsedBy: {
    type: Object,
    blackbox: true,
    defaultValue: {}
  }
});

// Nodes.attachSchema(NodeSchema);

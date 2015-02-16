Nodes = new Mongo.Collection("nodes");

NodeSchema = new SimpleSchema({

  // When displaying this node in a list of children, sort by this value
  // XXX it's possible that if we move nodes around a lot, this will exceed
  // the precision of JavaScript numbers. we won't care for now, but we might
  // have to do something about it in the future.
  order: {
    type: Number,
    decimal: true
  },

  // The id of the node that has this one as its child
  parent: {
    type: String,
    regEx: SimpleSchema.RegEx.Id,
    index: true
  },

  // The content of this node
  content: {
    type: String
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
    type: [String],
    regEx: SimpleSchema.RegEx.Id,
    denyUpdate: true
  },

  // A list of all of the users that have edited this node. When the node is
  // created, this is an array with the user who created it.
  updatedBy: {
    type: [String],
    regEx: SimpleSchema.RegEx.Id
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
    blackbox: true
  }
});

Nodes.attachSchema(NodeSchema);
NodeModel = function (nodeDocument) {
  _.extend(this, nodeDocument);
};

_.extend(NodeModel.prototype, {
  getParent: function () {
    return Nodes.findOne({ "children._id": pointer });
  },
  isCollapsedByCurrentUser: function () {
    return this.collapsedBy && this.collapsedBy[Meteor.userId()] === true;
  },
  getOrderedChildren: function () {
    if (! this.children || ! this.children.length) {
      return null;
    }

    var children = _.sortBy(this.children, "order");
    var childIds = _.pluck(children, "_id");

    var unsortedChildren = Nodes.find({_id: { $in: childIds } }).fetch();

    var childrenById = _.indexBy(unsortedChildren, "_id");

    return _.map(children, function (childRecord) {
      return childrenById[childRecord._id];
    });
  },
  updateContent: function (newContent) {
    Meteor.call("updateNodeContent", this._id, newContent);
  },
  remove: function () {
    Meteor.call("removeNode", this._id);
  },
  collapse: function () {
    Meteor.call("collapseNode", this._id);
  },
  expand: function () {
    Meteor.call("expandNode", this._id);
  },
  moveTo: function (newParentNodeId, beforeNodeId) {
    Meteor.call("moveNode", this._id, newParentNodeId, beforeNodeId);
  }
});
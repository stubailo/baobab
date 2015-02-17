NodeModel = function (nodeDocument) {
  _.extend(this, nodeDocument);
};

_.extend(NodeModel.prototype, {
  getParent: function () {
    return Nodes.findOne({ "children._id": this._id });
  },

  isCollapsedByCurrentUser: function () {
    return this.hasChildren() &&
      this.collapsedBy &&
      this.collapsedBy[Meteor.userId()] === true;
  },

  hasChildren: function() {
    return !!(this.children && this.children.length > 0);
  },

  getOrderedChildren: function () {
    if (! this.hasChildren()) {
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

  getArrowIcon: function() {
    return new Spacebars.SafeString(
      this.hasChildren()
        ? this.isCollapsedByCurrentUser()
          ? "&#9654;" : "&#9660;"
        : "&bull;"
    );
  },

  getArrowIconClasses: function() {
    if (this.content === null) {
      return " hidden";
    }

    if (! this.hasChildren()) {
      return " childless";
    }

    if (this.isCollapsedByCurrentUser()) {
      return " collapsed";
    }

    return " expanded";
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
  },
  isWriteableByUser: function (userId) {
    return this.permissions.readWrite.indexOf(userId) !== -1;
  },
  isReadableByUser: function (userId) {
    return isWriteableByCurrentUser() ||
      this.permissions.readOnly.indexOf(userId) !== -1;
  },
  isWriteableByCurrentUser: function () {
    this.isWriteableByUser(Meteor.userId());
  },
  isReadableByCurrentUser: function () {
    this.isReadableByUser(Meteor.userId());
  }
});
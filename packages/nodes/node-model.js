NodeModel = function (nodeDocument) {
  _.extend(this, nodeDocument);
};

_.extend(NodeModel.prototype, {
  getParent: function () {
    return Nodes.findOne({ "children._id": this._id });
  },

  isCollapsedByCurrentUser: function () {
    return this.collapsedBy &&
      this.collapsedBy[Meteor.userId()] === true;
  },

  // A node is visible if none of its ancestors are collapsed.
  isVisible: function() {
    var parent = this.getParent();
    if (parent) {
      if (parent.isCollapsedByCurrentUser()) {
        return false;
      }
      return parent.isVisible();
    }
    return true;
  },

  hasChildren: function() {
    return !!(this.children && this.children.length > 0);
  },

  getPreviousSibling: function() {
    var parent = this.getParent();
    return parent ? this._prevSiblingHelper(
      this._id,
      parent.getOrderedChildren()
    ) : null;
  },

  getNextSibling: function() {
    var parent = this.getParent();
    return parent ? this._prevSiblingHelper(
      this._id,
      parent.getOrderedChildren().reverse()
    ) : null;
  },

  _prevSiblingHelper: function(nodeID, children) {
    var previousSiblingID;

    _.some(children, function(child) {
      if (child._id === nodeID) {
        return true;
      }
      previousSiblingID = child._id;
      return false;
    });

    if (! previousSiblingID) {
      return null;
    }

    return Nodes.findOne(previousSiblingID);
  },

  getFirstChild: function() {
    var firstChild = _.min(this.children, function(child) {
      return child.order;
    });
    return firstChild ? Nodes.findOne(firstChild._id) : null;
  },

  getLastChild: function() {
    var lastChild = _.max(this.children, function(child) {
      return child.order;
    });
    return lastChild ? Nodes.findOne(lastChild._id) : null;
  },

  getPrecedingNode: function() {
    var pn = this.getPreviousSibling();

    while (pn) {
      var lastChild = pn.getLastChild();
      if (lastChild) {
        pn = lastChild;
      } else {
        return pn;
      }
    }

    return this.getParent();
  },

  getFollowingNode: function() {
    var firstChild = this.getFirstChild();
    if (firstChild) {
      return firstChild;
    }

    var nextSibling = this.getNextSibling();
    if (nextSibling) {
      return nextSibling;
    }

    var parent = this.getParent();
    while (parent) {
      var uncle = parent.getNextSibling();
      if (uncle) {
        return uncle;
      }
      parent = parent.getParent();
    }

    return null;
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
  moveTo: function (newParentNodeId, previousNodeId) {
    Meteor.call("moveNode", this._id, newParentNodeId, previousNodeId);
  },
  isWriteableByUser: function (userId) {
    return !! _.findWhere(this.permissions, {userIdOrToken: userId, write: true});
  },
  isWriteableByCurrentUser: function () {
    this.isWriteableByUser(Meteor.userId());
  },
  generateShareUrl: function (writeable) {
    var existingShareUrl = this.getShareUrl(writeable);
    if (existingShareUrl) {
      return existingShareUrl;
    }

    var token = Random.id();
    Meteor.call("shareNodeToPublicUrl", this._id, token, writeable);
  },
  getShareUrl: function (writeable) {
    var permsKey = writeable ? "readWrite" : "readOnly";

    // check if we already have a writeable share URL
    var perm = _.findWhere(this.permissions[permsKey], {type: "token"});

    if (perm) {
      // make sure the parent doesn't have the same token, so that this URL
      // will actually only share the current node
      var parent = this.getParent();
      var parentPerm = _.findWhere(parent.permissions[permsKey],
        {id: perm.id});

      if (! parentPerm) {
        return Meteor.absoluteUrl(this._id + "?token=" + perm.id);
      }
    }

    return null;
  }
});
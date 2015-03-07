// Call like fields(nodeId, "content", "collapsedBy")
var getFields = function (/* id, fields.. */) {
  var fieldsObj = {};

  var fields = _.rest(arguments);

  _.each(fields, function (fieldName) {
    fieldsObj[fieldName] = 1;
  });

  return Nodes.findOne(arguments[0], { fields: fieldsObj });
};

NodeModel = function (nodeDocument) {
  _.extend(this, nodeDocument);
};

_.extend(NodeModel.prototype, {
  getFields: function (/* fields.. */) {
    if (Meteor.isServer) {
      return this;
    }

    return getFields(this._id, arguments);
  },

  getField: function (fieldName) {
    console.log(this._id, fieldName);
    return getFields(this._id, fieldName)[fieldName];
  },

  getParent: function () {
    if (Meteor.isClient) {
      return Nodes.findOne({ "children._id": this._id }, { fields: { _id: 1 } });
    }

    return Nodes.findOne({ "children._id": this._id });
  },

  isCollapsedByCurrentUser: function () {
    var collapsedBy = this.getField("collapsedBy");

    return collapsedBy &&
      collapsedBy[Meteor.userId()] === true;
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
    var children = this.getField("children");

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
    var children = this.getField("children");

    var firstChild = _.min(children, function(child) {
      return child.order;
    });

    return firstChild ? Nodes.findOne(firstChild._id) : null;
  },

  getLastChild: function() {
    var children = this.getField("children");

    var lastChild = _.max(children, function(child) {
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
    var children = this.getField("children");

    if (_.isEmpty(children)) {
      return null;
    }

    var children = _.sortBy(children, "order");
    var childIds = _.pluck(children, "_id");

    var unsortedChildren = Nodes.find({_id: { $in: childIds } }).fetch();

    var childrenById = _.indexBy(unsortedChildren, "_id");

    return _.map(children, function (childRecord) {
      return childrenById[childRecord._id];
    });
  },

  getArrowIconClasses: function() {
    var classes = "";

    if (this.content === null) {
      classes += " hidden";
    } else if (! this.hasChildren()) {
      classes += " childless";
    } else if (this.isCollapsedByCurrentUser()) {
      classes += " collapsed";
    } else {
      classes += " expanded";
    }

    if (this.sharedWithMe()) {
      classes += " sharedWithMe";
    } else if (this.hasBeenShared()) {
      classes += " shared";
    }

    return classes;
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
    var permissions = this.getField("permissions");
    return !! _.findWhere(permissions.readWrite, {id: userId});
  },
  isReadableByUser: function (userId) {
    var permissions = this.getField("permissions");

    return isWriteableByCurrentUser() ||
      !! _.findWhere(permissions.readOnly, {id: userId});
  },
  isWriteableByCurrentUser: function () {
    this.isWriteableByUser(Meteor.userId());
  },
  isReadableByCurrentUser: function () {
    this.isReadableByUser(Meteor.userId());
  },
  shareWithUsername: function (username, writeable) {
    Meteor.call("shareNode", this._id, username, writeable);
  },
  sharedWithMe: function () {
    var permissions = this.getField("permissions");

    return _.findWhere(permissions.readWrite, {inherited: false, id: Meteor.userId()}) ||
      _.findWhere(permissions.readOnly, {inherited: false, id: Meteor.userId()});
  },
  hasBeenShared: function () {
    var permissions = this.getField("permissions");

    return _.findWhere(permissions.readWrite, {inherited: false}) ||
      _.findWhere(permissions.readOnly, {inherited: false});
  },
  multiUser: function () {
    var permissions = this.getField("permissions");

    return permissions.readOnly.length +
      permissions.readWrite.length !== 1;
  },
  unshareFrom: function (targetId) {
    Meteor.call("unshareNode", this._id, targetId);
  },
  getLinkedNode: function () {
    var link = this.getField("link");

    return Nodes.findOne(link);
  },
  isLocked: function () {
    var lockedBy = this.getField("lockedBy");

    var unlocked = ! lockedBy || lockedBy === Meteor.userId();
    return ! unlocked;
  },
  releaseLock: function () {
    Meteor.call('releaseOwnNodeLock', this._id);
  },
  setCursorPresent: function () {
    Meteor.call('setNodeCursorPresent', this._id);
  },
  clearCursorPresent: function () {
    Meteor.call('setNodeCursorPresent', this._id, 'clear');
  }
});
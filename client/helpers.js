var getHashCode = function(str) {
  var hash = 0;
  if (str.length == 0) return hash;
  for (var i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

Template.tree.helpers({
  getHTMLContent: function() {
    return new Spacebars.SafeString(this.content);
  },
  crumbs: function () {
    var crumbs = [];
    var node = this;

    while (true) {
      parent = node.getParent();

      if (! parent) {
        var linker = Nodes.findOne({link: node._id});
        if (linker) {
          parent = linker.getParent();
        }
      }

      node = parent;

      if (node.content === null) {
        crumbs.push({
          content: "home"
        });

        break;
      }

      crumbs.push(node);
    }

    return _.map(crumbs.reverse(), function (crumb, index) {
      crumb.index = index;
      return crumb;
    });
  }
});

var getColorFromId = function (id) {
  var h = getHashCode(id) % 360;

  return "hsl(" + h + ", 50%, 70%)";
}

Template.node.helpers({
  indent: function () {
    return 20;
  },

  contextMenu: function () {
    return this._id === Session.get("contextMenuNodeId");
  },

  getEditorDeindent: function () {
    var node = this;
    var root = Nodes.findOne(Session.get("rootNodeId"));
    var depth = 0;

    while (node && root && node._id !== root._id) {
      node = node.getParent();
      ++depth;
    }

    return -48 * depth;
  },

  lastUpdatedColor: function () {
    return getColorFromId(this.lastUpdatedBy._id);
  },

  maybeLocked: function () {
    return this.isLocked && this.isLocked() ? 'locked' : '';
  },

  maybeEditable: function () {
    return this.isLocked && this.isLocked() ? '': {'contentEditable': true};
  },

  whoseCursor: function () {
    var currentUsername = Meteor.user() && Meteor.user().username;
    var cursorUsername = this.cursorPresent && this.cursorPresent.username
    return currentUsername === cursorUsername ? '' : cursorUsername
  },

  whoseCursorColor: function () {
    var cursorUserId = this.cursorPresent && this.cursorPresent.userId
    if (! cursorUserId) return;
    return getColorFromId(cursorUserId)
  }
});

Template.body.helpers({
  contextMenu: function () {
    return Session.get("contextMenuNodeId");
  }
});

Template.registerHelper("calendar", function (date) {
  return moment(date).calendar();
});
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

  generatedColor: function () {
    var h = getHashCode(this.lastUpdatedBy._id) % 360;

    return "hsl(" + h + ", 50%, 70%)";
  },

  maybeLocked: function () {
    var unlocked = ! this.lockedBy || this.lockedBy === Meteor.userId();
    return this.isLocked() ? 'locked' : '';
  },

  maybeEditable: function () {
    var unlocked = ! this.lockedBy || this.lockedBy === Meteor.userId();
    return this.isLocked() ? '': {'contentEditable': true};
  },

  whoseCursor: function () {
    var currentUsername = Meteor.user() && Meteor.user().username;
    // var whoseCursor = this;
    // console.log('whose cursor: ', currentUsername, whoseCursor)
    return currentUsername === this.cursorPresent ? '' : this.cursorPresent
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
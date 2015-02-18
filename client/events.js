var focusedNode = null;
var templatesByNodeID = {};

Template.node.events({
  "focus .input": function(event, template) {
    focusedNode = template.data;
    // No need to call refocus because the input just received focus.
    return false;
  },

  "click .arrow": function(event, template) {
    var node = template.data;
    var collapsed = node.isCollapsedByCurrentUser();

    if (collapsed) {
      node.expand();
    } else {
      node.collapse();
      var candidate = focusedNode;
      while (candidate) {
        if (candidate._id === node._id) {
          focusedNode = node;
        }
        candidate = candidate.getParent();
      }
    }

    refocus();

    return false;
  },

  "keydown .input": function (event, template) {
    var node = this;

    if (event.which === 13) {
      if (! event.shiftKey) {
        var newNodeID = Nodes.insertNode(
          "", node.getParent()._id, node._id);
        focusedNode = Nodes.findOne(newNodeID);
        return false;
      }

    } else if (event.which === 38) { // up arrow
      var node = template.data;
      while (node) {
        var pn = node.getPrecedingNode();
        if (pn && pn.isVisible()) {
          focusedNode = pn;
          refocus();
          return false;
        }
        node = pn;
      }

    } else if (event.which === 40) { // down arrow
      var node = template.data;
      while (node) {
        var fn = node.getFollowingNode();
        if (fn && fn.isVisible()) {
          focusedNode = fn;
          refocus();
          return false;
        }
        node = fn;
      }
    }
  }
});

function refocus() {
  if (focusedNode && _.has(templatesByNodeID, focusedNode._id)) {
    var template = templatesByNodeID[focusedNode._id];
    template.find(".input").focus();
  }
}

Template.node.rendered = function() {
  if (! this.data) {
    return;
  }

  var nodeID = this.data._id;
  templatesByNodeID[nodeID] = this;
  refocus();
};

// TODO What does this really mean?
Template.node.destroyed = function() {
  if (! this.data) {
    return;
  }

  delete templatesByNodeID[this.data._id];

  if (this.data._id === focusedNode._id) {
    focusedNode = this.data.getParent();
  }
};

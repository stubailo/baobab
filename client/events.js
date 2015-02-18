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

  "keydown .input": function (event) {
    var node = this;
    var input = event.target;

    var updateText = _.debounce(function(node, input) {
      node.updateContent(input.textContent);
    }, 200);

    updateText(node, input);

    if (event.which === 13) { // enter
      if (! event.shiftKey) {
        var content = "";

        var selection = window.getSelection();
        if (selection.rangeCount === 1) {
          var range = selection.getRangeAt(0);
          range.deleteContents();
          var dummyDiv = document.createElement("div");
          range.insertNode(dummyDiv);
          while (dummyDiv.nextSibling) {
            dummyDiv.appendChild(dummyDiv.nextSibling);
          }
          content = dummyDiv.textContent;
          dummyDiv.parentNode.removeChild(dummyDiv);
        }

        var newNodeID = Nodes.insertNode(
          content, node.getParent()._id, node._id);
        focusedNode = Nodes.findOne(newNodeID);

        return false;
      }

    } else if (event.which === 38) { // up arrow
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
      while (node) {
        var fn = node.getFollowingNode();
        if (fn && fn.isVisible()) {
          focusedNode = fn;
          refocus();
          return false;
        }
        node = fn;
      }

    } else if (event.which === 8) { // delete
      var selection = window.getSelection();
      if (selection.rangeCount === 1) {
        var range = selection.getRangeAt(0);
        var container = range.startContainer;
        if (range.endContainer === container &&
            range.startOffset === 0 &&
            range.endOffset === 0) {
          while (container) {
            if (container === input) {
              var ps = node.getPreviousSibling();
              if (ps && ps.children.length === 0) {
                if (_.has(templatesByNodeID, ps._id)) {
                  var prevInput = templatesByNodeID[ps._id].find(".input");
                  var dummySpan = document.createElement("span");

                  prevInput.appendChild(dummySpan);
                  while (input.firstChild) {
                    prevInput.appendChild(input.firstChild);
                  }

                  node.remove();
                  focusedNode = ps;
                  selection.collapse(dummySpan, 0);
                  prevInput.removeChild(dummySpan);

                  updateText(ps, prevInput);

                } else {
                  node.remove();
                  focusedNode = ps;
                  refocus();
                }

              } else if (!node.content.match(/\S/)) {
                var pn = node.getPrecedingNode();
                if (pn) {
                  focusedNode = pn;
                  node.remove();
                  refocus();
                }
              }

              return false;
            }

            container = container.parentNode;
          }
        }
      }
    } else if (event.which === 9) { // tab
      if (event.shiftKey) {
        var parent = node.getParent();
        var grandparent = parent && parent.getParent();
        if (grandparent) {
          // Move the node to the next sibling of its parent.
          node.moveTo(grandparent._id, parent._id);
          focusedNode = node;
          refocus();
        }

        return false;
      }

      var ps = node.getPreviousSibling();
      if (ps) {
        var newPrevSibling = ps.getLastChild();
        if (newPrevSibling) {
          node.moveTo(ps._id, newPrevSibling._id);
        } else {
          node.moveTo(ps._id);
        }

        focusedNode = node;
        refocus();
      }

      return false;
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
  var node = this.data;
  if (! node) {
    return;
  }

  this.find(".input").textContent = node.content;

  var nodeID = node._id;
  templatesByNodeID[nodeID] = this;
  refocus();
};

// TODO What does this really mean?
Template.node.destroyed = function() {
  if (! this.data) {
    return;
  }

  delete templatesByNodeID[this.data._id];
};

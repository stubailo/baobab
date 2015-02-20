Session.setDefault("contextMenuNodeId", null);

// Prevent scrolling when the context menu is open
Meteor.startup(function () {
  $(window).on("mousewheel", function () {
    if (Session.get("contextMenuNodeId") || Session.get("shareModalNodeId")) {
      return false;
    }
  });
});

function deleteMarkers(input) {
  var markers = input.getElementsByTagName("marker");

  // BEWARE that markers is a live-updating NodeList, so iterating
  // forwards will change the list with each removal, leaving some markers
  // in the input element!!
  for (var i = markers.length - 1; i >= 0; --i) {
    var marker = markers.item(i);
    var parent = marker.parentNode;
    if (parent) {
      parent.removeChild(marker);
    }
  }
}

function insertMarkers(node) {
  if (_.has(recordedSelectionsByID, node._id)) {
    var input = getTemplateByNodeID(node._id).find(".input");
    var range = recordedSelectionsByID[node._id];
    var startMarker = document.createElement("marker");
    var endMarker = document.createElement("marker");
    var endRange = range.cloneRange();

    deleteMarkers(input);

    endRange.collapse(false); // Collapse to end.
    range.collapse(true); // Collapse to start.
    range.insertNode(startMarker);
    endRange.insertNode(endMarker);

    saveContents(node);
  }
}

function saveContents(node) {
  var template = getTemplateByNodeID(node._id);
  var input = template && template.find(".input");
  if (input) {
    var markers = input.getElementsByTagName("marker");
    var reinsertions = [];

    while (markers.length > 0) {
      var lastMarker = markers.item(markers.length - 1);
      reinsertions.push({
        marker: lastMarker,
        parentNode: lastMarker.parentNode,
        nextSibling: lastMarker.nextSibling
      });
      lastMarker.parentNode.removeChild(lastMarker);
    }

    // Save input.innerHTML without any markers.
    node.updateContent(input.innerHTML);

    // Restore the markers to their original locations.
    while (reinsertions.length > 0) {
      var r = reinsertions.pop();
      r.parentNode.insertBefore(r.marker, r.nextSibling);
    }
  }
}

Template.node.helpers({
  getSelectionClass: function() {
    var status = selectedStatusByNodeID.get(this._id);
    if (status === SelectedStatus.UNSELECTED) {
      return "";
    }
    return " selected";
  }
});

var SelectedStatus = {
  UNSELECTED: 0,
  SHIFT: 1,
  ANCHORED: 2
};
var selectedStatusByNodeID = new ReactiveDict();
var anchorNumberByNodeID = {};
var nextAnchorNumber = 0;

function getMaxAnchorNodeID() {
  var maxNumber = -1;
  var maxNodeID;

  _.each(anchorNumberByNodeID, function(number, nodeID) {
    if (number > maxNumber) {
      maxNumber = number;
      maxNodeID = nodeID;
    }
  });

  return maxNodeID;
}

function toggleSelected(node) {
  var status = selectedStatusByNodeID.get(node._id);
  if (status === SelectedStatus.UNSELECTED) {
    addAnchorNode(node);
    selectedStatusByNodeID.set(node._id, SelectedStatus.ANCHORED);
  } else {
    delete anchorNumberByNodeID[node._id];
    selectedStatusByNodeID.set(node._id, SelectedStatus.UNSELECTED);
  }
}

function addAnchorNode(node) {
  anchorNumberByNodeID[node._id] = nextAnchorNumber++;
}

function extendSelected(node) {
  var anchorNodeID = getMaxAnchorNodeID();
  var anchorNode = anchorNodeID && Nodes.findOne(anchorNodeID);
  var rootNode = Nodes.findOne(Session.get("rootNodeId"));

  if (anchorNode) {
    clearShiftSelected();

    var sawAnchorNode = false;
    var sawNodeNode = false;
    var pointer = rootNode;

    while (! (sawAnchorNode && sawNodeNode)) {
      if (pointer._id === anchorNode._id) {
        sawAnchorNode = true;
      }

      if (pointer._id === node._id) {
        sawNodeNode = true;
      }

      if (sawAnchorNode || sawNodeNode) {
        var status = selectedStatusByNodeID.get(pointer._id);
        if (status === SelectedStatus.UNSELECTED) {
          selectedStatusByNodeID.set(pointer._id, SelectedStatus.SHIFT);
        }
      }

      pointer = pointer.getFollowingNode();
    }

  } else if (focusedNode) {
    addAnchorNode(focusedNode);
    extendSelected(node);

  } else {
    // As a last effort, we could examine window.getSelection(), but
    // focusedNode should be set if any node has focus.
  }
}

function clearShiftSelected(node) {
  var shiftSelectedNodeIDs = [];

  _.each(selectedStatusByNodeID.keys, function(value, nodeID) {
    var status = selectedStatusByNodeID.get(nodeID);
    if (status === SelectedStatus.SHIFT) {
      // Bad to modify a ReactiveDict while iterating over it, so save
      // these node IDs for later.
      shiftSelectedNodeIDs.push(nodeID);
    }
  });

  _.each(shiftSelectedNodeIDs, function(nodeID) {
    selectedStatusByNodeID.set(nodeID, SelectedStatus.UNSELECTED);
  });
}

function clearAllSelected() {
  _.each(selectedStatusByNodeID.keys, function(value, nodeID) {
    selectedStatusByNodeID.set(nodeID, SelectedStatus.UNSELECTED);
  });

  anchorNumberByNodeID = {};
  nextAnchorNumber = 0;
}
// TODO Find a better way of doing this.
document.addEventListener("mousedown", clearAllSelected);

Template.node.events({
  "focus .input": function(event, template) {
    recordNodeAsFocused(template.data);
    this.setCursorPresent();
    // No need to call refocus because the input just received focus.
    return false;
  },

  "blur .input": function(event, template) {
    insertMarkers(this);
    this.releaseLock();
    this.clearCursorPresent();
    event.stopPropagation();
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
          refocus(node);
          break;
        }
        candidate = candidate.getParent();
      }
    }

    return false;
  },

  "contextmenu .arrow": function (event, template) {
    Session.set("contextMenuNodeId", this._id);
    Session.set("contextMenuPosition", template.$(".bullet").offset());

    $(window).one("blur", function () {
      Session.set("contextMenuNodeId", null);
    });

    return false;
  },

  "mousedown .input": function(event) {
    recordSelection.apply(this, arguments);

    if (event.metaKey) {
      toggleSelected(this);
      return false;
    }

    if (event.shiftKey) {
      extendSelected(this);
      return false;
    }

    clearAllSelected();
    event.stopPropagation();
  },

  "keypress .input": recordSelection,
  "mouseup .input": recordSelection,
  "mouseout .input": recordSelection,

  "keyup .input": function (event) {
    //non-printing keys include ctrl, arrows, tab, etc.
    var nonPrintingKeys = _.range(9, 28).concat(_.range(33, 41).concat(91));

    if (! _.contains(nonPrintingKeys, event.which)) {
      saveContents(this);
    }

    return false;
  },

  "keydown .input": function (event) {
    var node = this;
    var input = event.target;

    recordSelection.apply(this, arguments);

    // TODO Debounce this?

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
          content = dummyDiv.innerHTML;
          dummyDiv.parentNode.removeChild(dummyDiv);
        }

        var newNodeID = Nodes.insertNode(
          content, node.getParent()._id, node._id);

        recordNodeAsFocused(Nodes.findOne(newNodeID));

        return false;
      }

    } else if (event.which === 38) { // up arrow
      if (event.shiftKey) {
        // Don't prevent shift/arrow-based selection.
        return;
      }

      while (node) {
        var pn = node.getPrecedingNode();
        if (pn && pn.isVisible() && ! pn.isLocked()) {
          refocus(pn);
          return false;
        }
        node = pn;
      }

    } else if (event.which === 40) { // down arrow
      if (event.shiftKey) {
        // Don't prevent shift/arrow-based selection.
        return;
      }

      while (node) {
        var fn = node.getFollowingNode();
        if (fn && fn.isVisible() && ! fn.isLocked()) {
          refocus(fn);
          return false;
        }
        node = fn;
      }

    } else if (event.which === 8) { // delete
      var selection = window.getSelection();

      for (var i = 0; i < selection.rangeCount; ++i) {
        var range = selection.getRangeAt(i);
        if (!input.contains(range.startContainer)) {
          continue;
        }

        // Select all content from beginning of input so we can check if
        // the text is all whitespace.
        range = range.cloneRange();
        range.collapse(false); // Collapse to end.
        range.setStart(input, 0);

        if (rangeContainsAnyRealContents(range)) {
          // If there is anything that could be deleted before the end of
          // the cursor, then don't consider deleting this node.
          continue;
        }

        if (node.children.length > 0) {
          // Can't delete nodes that have children. This is a little
          // different from Workflowy, which allows you to delete nodes that
          // have empty children.
          continue;
        }

        var ps = node.getPreviousSibling();
        if (ps && ps.children.length === 0) {
          var template = getTemplateByNodeID(ps._id);
          if (template) {
            var prevInput = template.find(".input");
            var dummySpan = document.createElement("span");

            prevInput.appendChild(dummySpan);
            while (input.firstChild) {
              prevInput.appendChild(input.firstChild);
            }

            node.remove();
            recordNodeAsFocused(ps);
            selection.collapse(dummySpan, 0);
            prevInput.removeChild(dummySpan);

            saveContents(ps);

          } else {
            node.remove();
            refocus(ps);
          }

          return false;

        } else if (!nodeContainsAnyRealContents(input)) {
          var pn = node.getPrecedingNode();
          if (pn) {
            node.remove();
            refocus(pn);
            return false;
          }
        }
      }

    } else if (event.which === 9) { // tab
      if (event.shiftKey) {
        var parent = node.getParent();
        var grandparent = parent && parent.getParent();
        if (grandparent) {
          // Move the node to the next sibling of its parent.
          insertMarkers(node);
          node.moveTo(grandparent._id, parent._id);
          refocus(node);
        }

        return false;
      }

      var ps = node.getPreviousSibling();
      if (ps) {
        insertMarkers(node);

        var newPrevSibling = ps.getLastChild();
        if (newPrevSibling) {
          node.moveTo(ps._id, newPrevSibling._id);
        } else {
          node.moveTo(ps._id);
        }

        refocus(node);
      }

      return false;
    }
  }
});

function rangeContainsAnyRealContents(range) {
  if (range.toString() !== "") {
    return true;
  }

  var docFrag = range.cloneContents();
  return nodeContainsAnyRealContents(docFrag);
}

function nodeContainsAnyRealContents(node) {
  for (var child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 3) {
      if (child.nodeValue.match(/\S/)) {
        return true;
      }
    } else if (!child.nodeName.match(/marker/i)) {
      return true;
    }
  }

  return false;
}

var recordedSelectionsByID = {};

function recordSelection(event) {
  var node = this;
  var input = event.target;

  var selection = window.getSelection();
  if (selection.rangeCount === 0) {
    return;
  }

  for (var i = 0; i < selection.rangeCount; ++i) {
    var range = selection.getRangeAt(0);
    if (input.contains(range.startContainer)) {
      recordedSelectionsByID[node._id] = range;
      return;
    }
  }

  delete recordedSelectionsByID[node._id];
}

var focusedNode = null;
var focusedInput = null;
function recordNodeAsFocused(node) {
  focusedNode = node;
  var template = getTemplateByNodeID(node._id);
  focusedInput = template && template.find(".input");
}

function refocus(newFocusedNode) {
  if (newFocusedNode) {
    recordNodeAsFocused(newFocusedNode);
  }

  var template = focusedNode && getTemplateByNodeID(focusedNode._id);
  if (template) {
    var input = template.find(".input");
    var markers = input.getElementsByTagName("marker");

    while (markers.length > 2) {
      var lastMarker = markers.item(markers.length - 1);
      lastMarker.parentNode.removeChild(lastMarker);
    }

    if (markers.length === 2) {
      var startMarker = markers.item(0);
      var endMarker = markers.item(1);

      var selection = window.getSelection();
      selection.removeAllRanges();

      var startContainer = startMarker.parentNode;
      var startOffset = indexOfNode(startMarker);

      var endContainer = endMarker.parentNode;
      var endOffset = indexOfNode(endMarker);

      selection.collapse(startContainer, startOffset);
      selection.extend(endContainer, endOffset);
    }

    input.focus();
  }
}

function indexOfNode(node) {
  var result = -1;
  while (node) {
    node = node.previousSibling;
    ++result;
  }
  return result;
}

var templatesByNodeID = {};
function getTemplateByNodeID(nodeID) {
  if (_.has(templatesByNodeID, nodeID)) {
    return templatesByNodeID[nodeID];
  }
  return null;
}

Template.node.rendered = function() {
  var template = this;
  var node = template.data;
  if (! node) {
    return;
  }

  var nodeID = node._id;
  var firstTime = true;

  templatesByNodeID[nodeID] = template;

  selectedStatusByNodeID.setDefault(nodeID, SelectedStatus.UNSELECTED);

  Tracker.autorun(function(computation) {
    if (getTemplateByNodeID(nodeID) !== template) {
      computation.stop();
      return;
    }

    var node = Nodes.findOne(nodeID);
    var input = node && template.find(".input");
    if (input) {
      // If this node was previously focused but we have rendered a new
      // input <div>, set the new input's contents to the children of the
      // old input before updating focusedInput.
      if (firstTime &&
          focusedNode && focusedNode._id === node._id &&
          focusedInput && focusedInput !== input) {
        while (input.firstChild) {
          input.removeChild(input.firstChild);
        }

        while (focusedInput.firstChild) {
          input.appendChild(focusedInput.firstChild);
        }

        recordNodeAsFocused(node);

      } else if (firstTime ||
                 document.activeElement !== input ||
                 ! document.hasFocus()) {
        input.innerHTML = node.content;
      }
    }

    firstTime = false;
  });

  refocus();
};

// TODO What does this really mean?
Template.node.destroyed = function() {
  if (! this.data) {
    return;
  }

  delete templatesByNodeID[this.data._id];
};

Template.body.events({
  "contextmenu .context-menu-overlay, click .context-menu-overlay": function () {
    Session.set("contextMenuNodeId", null);
    return false;
  }
});

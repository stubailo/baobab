// {
//   content: "x",
//   children: [
//     { content: "y" },
//     { content: "z" }
//   ]
// }
// 
// parentId and order are optional
var createTestTree = function (nodeTree, userId, parentId, order) {
  var newParentId = NodeTrustedApi.insertNode(nodeTree.content, Random.id(),
    parentId, order, userId);

  _.each(nodeTree.children, function (child, index) {
    createTestTree(child, userId, newParentId, index);
  });

  return newParentId;
};

var getIdForContent = function (content) {
  return Nodes.findOne({content: content})._id;
};

Tinytest.add('insertNode', function (test) {
  var userId = Accounts.createUser({
    username: Random.id(),
    password: "test"
  });

  Nodes.remove({});

  var rootId = createTestTree({
    content: "a",
    children: [
      { content: "b" },
      { content: "c" },
      { content: "f",
        children: [
          { content: "d" },
          { content: "e" }
        ]
      }
    ]
  }, userId);

  // Iterate over the tree and make sure it has the right content
  var content = [];
  var recursivelyAddContentAndCheck = function (node) {
    content.push(node.content);

    var parent = node.getParent();

    if (parent) {
      // If there is a parent, permissions should be inherited
      test.equal(NodeTrustedApi._markPermissionsInherited(parent.permissions),
        node.permissions);
    } else {
      // If there is no parent this is a root node
      test.isFalse(_.findWhere(node.permissions, {level: "readOnly"}));
      test.equal(node.permissions.length, 1);
    }

    _.each(node.getOrderedChildren(), recursivelyAddContentAndCheck);
  };
  recursivelyAddContentAndCheck(Nodes.findOne(rootId));

  test.equal(content.join(""), "abcfde");
});

Tinytest.add('removeNode', function (test) {
  var userId = Accounts.createUser({
    username: Random.id(),
    password: "test"
  });

  Nodes.remove({});

  createTestTree({
    content: "a",
    children: [
      { content: "b" },
      { content: "c" },
      { content: "f",
        children: [
          { content: "d" },
          { content: "e" }
        ]
      }
    ]
  }, userId);

  // We started with 6 nodes
  test.equal(Nodes.find().count(), 6);

  var fNodeId = Nodes.findOne({content: "f"})._id;
  NodeTrustedApi.removeNode(fNodeId, {userId: userId});

  // The whole subtree should be removed, leaving us with 3 nodes
  test.equal(Nodes.find().count(), 3);

  // Make sure some random user can't remove it!
  test.throws(function () {
    NodeTrustedApi.removeNode(fNodeId, {userId: "fakeuserid"});
  });
});

Tinytest.add('sharing nodes', function (test) {
  var userId = Accounts.createUser({
    username: Random.id(),
    password: "test"
  });

  Nodes.remove({});

  createTestTree({
    content: "a",
    children: [
      { content: "b" },
      { content: "c" },
      { content: "f",
        children: [
          { content: "d" },
          { content: "e" }
        ]
      }
    ]
  }, userId);

  // We started with 6 nodes
  test.equal(Nodes.find().count(), 6);

  var fNodeId = Nodes.findOne({content: "f"})._id;

  // Make sure some random user can't remove it!
  test.throws(function () {
    NodeTrustedApi.removeNode(fNodeId, {userId: "fakeuserid"});
  });

  // Share the node
  var shareToken = Random.id();
  NodeTrustedApi.shareNodeToPublicUrl(fNodeId, shareToken, true, userId);

  // Now remove a subnode using the share token as the permission
  var dNodeId = Nodes.findOne({content: "d"})._id;
  NodeTrustedApi.removeNode(dNodeId, {token: shareToken});
  test.equal(Nodes.find().count(), 5);

  // Now remove the subtree using the share token as the permission
  NodeTrustedApi.removeNode(fNodeId, {token: shareToken});
  test.equal(Nodes.find().count(), 3);
});

Tinytest.add('moving nodes with complex permissions', function (test) {
  var userId = Accounts.createUser({
    username: Random.id(),
    password: "test"
  });

  Nodes.remove({});

  createTestTree({
    content: "a",
    children: [
      { content: "b" },
      { content: "c",
        children: [
          { content: "d",
            children: [
              { content: "e"}
            ]
          }
        ]
      }
    ]
  }, userId);

  var shareNode = function (content) {
    var nodeId = Nodes.findOne({content: content})._id;

    var shareToken = content;
    NodeTrustedApi.shareNodeToPublicUrl(nodeId, shareToken, true, userId);
    return shareToken;
  };

  var tokens = {};
  _.each(["a", "b", "c", "d", "e"], function (content) {
    tokens[content] = shareNode(content);
  });

  var checkPermissions = function (content, expectedPermissions) {
    var node = Nodes.findOne({content: content});

    // Make sure there are no extra permissions. We need to add 1 because each
    // node additionally has permissions for userId
    test.equal(node.permissions.length, expectedPermissions.length + 1);

    _.each(expectedPermissions, function (letter) {
      var token = tokens[letter];

      // Make sure all of the permissions we are looking for are there
      test.isTrue(_.findWhere(node.permissions, {token: token}));
    });
  };

  checkPermissions("a", ["a"]);
  checkPermissions("b", ["a", "b"]);
  checkPermissions("c", ["a", "c"]);
  checkPermissions("d", ["a", "c", "d"]);
  checkPermissions("e", ["a", "c", "d", "e"]);

  // Move node d to parent b
  var dNodeId = getIdForContent("d");
  var bNodeId = getIdForContent("b");
  NodeTrustedApi.moveNode(dNodeId, bNodeId, null, userId);

  checkPermissions("a", ["a"]);
  checkPermissions("b", ["a", "b"]);
  checkPermissions("c", ["a", "c"]);
  checkPermissions("d", ["a", "b", "d"]);
  checkPermissions("e", ["a", "b", "d", "e"]);
});

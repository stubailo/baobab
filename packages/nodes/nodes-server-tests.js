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
      test.isTrue(_.isEmpty(node.permissions.readOnly));
      test.equal(node.permissions.readWrite.length, 1);
    }

    _.each(node.getOrderedChildren(), recursivelyAddContentAndCheck);
  };
  recursivelyAddContentAndCheck(Nodes.findOne(rootId));

  test.equal(content.join(""), "abcfde");
});

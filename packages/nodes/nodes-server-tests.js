Tinytest.add('inserting a node', function (test) {
  var userId = Accounts.createUser({
    username: Random.id(),
    password: "test"
  });

  var id = Nodes.insert({
    content: "this is content",
    createdBy: userId,
    updatedBy: [userId]
  });

  test.isTrue(Match.test(Nodes.findOne(id), {
    content: "this is content",
    createdBy: userId,
    updatedBy: [userId],
    children: [String],
    createdAt: Date,
    updatedAt: Date,
    collapsedBy: {},
    _id: id
  }));

  test.throws(function () {
    Nodes.insert({});
  });
});

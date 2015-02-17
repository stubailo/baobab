if (Meteor.isServer) {
  Accounts.onCreateUser(function (options, user) {
    user._id = Random.id();

    var rootNodeId = NodeTrustedApi.insertNode(null, Random.id(), null, 0, user._id);

    user.rootNodeId = rootNodeId;

    return user;
  });

  Meteor.publish("user-root-node", function () {
    return Meteor.users.find(this.userId, { fields: { rootNodeId: 1 }});
  });
} else {
  Meteor.subscribe("user-root-node");
}
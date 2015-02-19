if (Meteor.isServer) {
  Meteor.publish('nodes', function () {
    if (this.userId) {
      return Nodes.find({
        permissions: {
          $elemMatch: {
            read: true,
            userIdOrToken: this.userId
          }
        }
      });
    }
  });

  Meteor.publish('nodesTokenAuth', function (token) {
    if (token) {
      return Nodes.find({
        permissions: {
          $elemMatch: {
            read: true,
            userIdOrToken: token
          }
        }
      });
    }
  });
}

if (Meteor.isClient) {
  Meteor.subscribe('nodes');
}

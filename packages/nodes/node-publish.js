if (Meteor.isServer) {
  Meteor.publish('nodes', function () {
    if (this.userId) {
      return Nodes.find({
        $or: [
          {"permissions.readWrite.id": this.userId},
          {"permissions.readOnly.id": this.userId}
        ]
      });
    }
  });

  Meteor.publish('nodesTokenAuth', function (token) {
    if (token) {
      return Nodes.find({
        $or: [
          {"permissions.readWrite.id": token},
          {"permissions.readOnly.id": token}
        ]
      });
    }
  });
}

if (Meteor.isClient) {
  Meteor.subscribe('nodes');
}

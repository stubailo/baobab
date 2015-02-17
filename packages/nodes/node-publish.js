if (Meteor.isServer) {
  Meteor.publish('nodes', function () {
    return Nodes.find({
      $or: [
        {"permissions.readWrite": this.userId},
        {"permissions.readOnly": this.userId}
      ]
    });
  });

  Meteor.publish('nodesTokenAuth', function (token) {
    return Nodes.find({
      $or: [
        {"permissions.readWrite": token},
        {"permissions.readOnly": token}
      ]
    });
  });
}

if (Meteor.isClient) {
  Meteor.subscribe('nodes');
}

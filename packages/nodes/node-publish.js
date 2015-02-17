if (Meteor.isServer) {
  Meteor.publish('nodes', function () {
    return Nodes.find({
      $or: [
        {"permissions.readWrite": this.userId},
        {"permissions.readOnly": this.userId}
      ]
    });
  });
}

if (Meteor.isClient) {
  Meteor.subscribe('nodes');
}

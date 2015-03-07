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
}

if (Meteor.isClient) {
  Meteor.subscribe('nodes');
}

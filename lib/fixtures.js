NodesLocal = new Mongo.Collection(null);

Meteor.startup(function(){

  if (NodesLocal.find().count() === 0) {
    var subnode1 = NodesLocal.insert({
      body: "like so",
      level: 2
    });
    var subnode = NodesLocal.insert({
      body: "You can nest bullets, yay!",
      level: 1,
      children: [subnode1]
    });
    NodesLocal.insert({
      body: "Welcome to Baobab!",
      level: 0
    });
    NodesLocal.insert({
      body: "Start typing below",
      level: 0,
      children: [subnode]
    });

  };
});
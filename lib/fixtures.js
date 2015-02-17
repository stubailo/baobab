NodesLocal = new Mongo.Collection(null);

Meteor.startup(function(){
  if (NodesLocal.find().count() === 0) {
    NodesLocal.insert({
      body: null,
      children: [
        NodesLocal.insert({
          body: "Welcome to Baobab!"
        }),
        NodesLocal.insert({
          body: "Start typing below",
          children: [
            NodesLocal.insert({
              body: ""
            }),
            NodesLocal.insert({
              body: "You can nest bullets, yay!",
              children: [NodesLocal.insert({
                body: "like so"
              })]
            })
          ]
        })
      ]
    });
  };
});
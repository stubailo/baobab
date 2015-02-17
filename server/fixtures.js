Meteor.startup(function(){
  if (Nodes.find().count() === 0) {
    var rootID = Nodes.insertNode(null);
    var welcomeID = Nodes.insertNode("Welcome to Baobab!", rootID);
    var typingID = Nodes.insertNode("Start typing below", welcomeID);
    Nodes.insertNode("", typingID);
    Nodes.insertNode("like so", typingID);
  };
});

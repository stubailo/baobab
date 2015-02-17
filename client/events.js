Template.node.events({
  "click span.arrow": function(event, template) {
    var collapsed = template.data.collapsedBy &&
      template.data.collapsedBy[Meteor.userId()] === true;
    
    Meteor.call(
      collapsed ? "unCollapseNode" : "collapseNode",
      template.data._id
    );

    return false;
  }
});
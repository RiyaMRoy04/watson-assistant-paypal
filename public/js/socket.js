/* global io: true, ConversationPanel: true, Api: true */
/* eslint no-unused-vars: "off" */

var Socket = (function() {
  var settings = {
    authorTypes: {
      user: 'user',
      watson: 'watson'
    }
  };
  return {
    init: init
  };

  // Initialize the module
  function init() {
    var socket = io.connect('http://localhost:3000');

    socket.on('message', function (data) {
      if (data) {
        Api.setResponsePayload(JSON.stringify(data));
      }
    });
  }


}());

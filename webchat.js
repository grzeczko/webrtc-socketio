var fs = require('fs');
var PeerServer = require('peer').PeerServer;
var express = require('express');
var https = require('https');

var key = fs.readFileSync('./....key');
var cert = fs.readFileSync('./....crt');
var https_options = {
    key: key,
    cert: cert
};
var app = express();

var server = new PeerServer({
  port: 9002,
  path: '/speed',
  ssl: https_options
});

var connected = [];
server.on('connection', function (id) {
  var idx = connected.indexOf(id); // only add id if it's not in the list yet
  if (idx === -1) {connected.push(id);}
});
server.on('disconnect', function (id) {
  var idx = connected.indexOf(id); // only attempt to remove id if it's in the list
  if (idx !== -1) {connected.splice(idx, 1);}
});

app.get('/connected-people', function (req, res) {
  return res.json(connected);
});

var listener = https.createServer(https_options, app);
var io = require('socket.io').listen(listener);
listener.listen(9003, function(){
    console.log('Listening on port ' + listener.address().port); //Listening on port 8888
});

var clients = {};
var theirId = [];
var userId = 0;
io.on('connection', function(socket){
  socket.on('storeId', function (data) {
    userId = data.customId;
    clients[userId] = socket;
    theirId[userId] = 0;
  });

  socket.on('initCall', function(data){
    if (theirId[data.callTo] !== undefined && theirId[data.callTo] !== 0) {
        clients[data.myId].emit('busy', {callTo: data.callTo, myId: data.myId});
    }
    else {
        theirId[data.myId] = data.callTo;
        theirId[data.callTo] = data.myId;
        clients[data.callTo].emit('approveCallPrompt', {callTo: data.callTo, myId: data.myId, name: data.name, photo: data.photo});
    }
  });

  socket.on('declineCall', function(data){
      clients[data.declineTo].emit('declineCall');
      theirId.splice(data.myId, 1);
  });

  socket.on('endCall', function(data){
    if (clients[data.endTo] !== undefined) {
        clients[data.endTo].emit('endCall');
    }
    theirId.splice(data.myId, 1);
  });

  socket.on('disconnect', function(){
    var key = Object.keys(clients).filter(function(key) {return clients[key] === socket})[0];
    if (theirId[key] !== undefined && clients[theirId[key]] !== undefined) {
      clients[theirId[key]].emit('endCall');
      theirId.splice(theirId[key], 1);
      theirId.splice(key, 1);
    }
    delete clients[key];
    userId = 0;
  });
});

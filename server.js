const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const express = require('express');
var firebase = require('firebase');
const socketio = require('socket.io');
const WebSocket = require('ws');
const formatMessage = require('./utils/messages');
const {
  userJoin,
  getCurrentUser,
  userLeave,
  getRoomUsers
} = require('./utils/users');

const app = express();
//const server = https.createServer(app);

var privateKey  = fs.readFileSync('key.pem');
var certificate = fs.readFileSync('cert.pem');

var credentials = {key: privateKey, cert: certificate};

// your express configuration here

var httpServer = http.createServer(app);
var server = https.createServer(credentials, app);

httpServer.listen(8080);
//server.listen(8443);

const io = socketio(server);

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

const botName = 'SquashCord Bot';

// Run when client connects
io.on('connection', socket => {
  socket.on('joinRoom', ({ username, room }) => {
    const user = userJoin(socket.id, username, room);

    // Welcome current user
  users = getRoomUsers(user.room);

    socket.join(user.room);
    
    socket.emit('message', formatMessage(botName, 'Welcome to SquashCord!'));
    // Broadcast when a user connects
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        formatMessage(botName, `${user.username} has joined the chat`)
      );

    // Send users and room info
    io.to(user.room).emit('roomUsers', {
      room: user.room,
      users: getRoomUsers(user.room)
    });
  });

  socket.on('full_room',msg => {
    socket.emit('room_full',msg);
  });
  // Listen for chatMessage
  socket.on('chatMessage', msg => {
    const user = getCurrentUser(socket.id);
    io.to(user.room).emit('message', formatMessage(user.username, msg));
  });
  
  socket.on('videomessage',msg =>{
    const user = getCurrentUser(socket.id);
    socket.broadcast.to(user.room).emit('vmessage',msg);
  });



  // Runs when client disconnects
  socket.on('disconnect', () => {
    const user = userLeave(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        formatMessage(botName, `${user.username} has left the chat`)
      );

      // Send users and room info
      io.to(user.room).emit('roomUsers', {
        room: user.room,
        users: getRoomUsers(user.room)
      });
    }
  });
});

const PORT = process.env.PORT || 8443;

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

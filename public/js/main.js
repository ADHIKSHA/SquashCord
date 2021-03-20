const chatForm = document.getElementById('chat-form');
const chatMessages = document.querySelector('.chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
//const video = require('./utils/video');
const socket = io();

 var servers = {
    'iceServers': [{
        'urls': 'stun:stun.services.mozilla.com'
    }, {
        'urls': 'stun:stun.l.google.com:19302'
    }, {
        'urls': 'turn:numb.viagenie.ca',
        'credential': 'Adhiksha@123',
        'username': 'adhikshat1905@gmail.com'
    }]
};

const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});
var database;
const WS_PORT = 8443; //make sure this matches the port for the webscokets server
var yourVideo;
var friendsVideo;
var desc;
var localUuid;
var localDisplayName =username;
var localStream;
var serverConnection;
var peerConnections = {}; // key is uuid, values are peer connection object and user defined display name string
var peerUuid;


  var firebaseConfig = {
    'apiKey': 'AIzaSyBrJciZ3GS_tf9fpXZHXShQG6vGsM3FFDg',
    'authDomain': 'videochat-96f4e.firebaseapp.com',
    'databaseURL': 'https://videochat-96f4e.firebaseio.com',
    'projectId': 'videochat-96f4e',
    'storageBucket': 'videochat-96f4e.appspot.com',
    'messagingSenderId': '110306645620',
    'appId': '1:110306645620:web:6dae39c7ea8b530d02a321',
    'measurementId': 'G-4WHSVHFN7E'
};
//var firebase = require('firebase');
firebase.initializeApp(firebaseConfig);
var database = firebase.database().ref();

localUuid = Math.floor(Math.random() * 1000000000);



//////////////////////////////////////////////////////////////////////////////////

function setUpPeer(peerUuid, displayName, initCall = false) {
  peerConnections[peerUuid] = { 'uuid': peerUuid, 'pc': new RTCPeerConnection(servers) };
  peerConnections[peerUuid].pc.onicecandidate = event => gotIceCandidate(event, peerUuid);
  peerConnections[peerUuid].pc.ontrack = event => gotRemoteStream(event, peerUuid);
  peerConnections[peerUuid].pc.oniceconnectionstatechange = event => checkPeerDisconnect(event, peerUuid);
  peerConnections[peerUuid].pc.addStream(localStream);

  if (initCall) {
    peerConnections[peerUuid].pc.createOffer().then(description => createdDescription(description, peerUuid)).catch(errorHandler);
  }
}
function errorHandler(error) {
  console.log(error);
}

function sendMessage(sender, msg,name) {
    var x = database.push(JSON.stringify({
        'uuid': sender,
        'message': msg,
        'displayName':name,
    }));
    console.log(x);
    peerUuid = sender;
    x.remove();
}

function gotIceCandidate(event, peerUuid) {
  if (event.candidate != null) {
    io.sockets.in(room).emit('videomessage',JSON.stringify({ 'ice': event.candidate, 'uuid': localUuid, 'dest': peerUuid }));
    sendMessage(localUuid,JSON.stringify({'ice': event.candidate}),localDisplayName);
  }
}

function createdDescription(description, peerUuid) {
  console.log(`got description, peer ${peerUuid}`);
  peerConnections[peerUuid].pc.setLocalDescription(description).then(function () {
    io.sockets.in(room).emit('videomessage',JSON.stringify({ 'sdp': peerConnections[peerUuid].pc.localDescription, 'uuid': localUuid, 'dest': peerUuid }));
  }).catch(errorHandler);
}

function gotRemoteStream(event, peerUuid) {
  console.log(`got remote stream, peer ${peerUuid}`);
  //assign stream to new HTML video element
  var vidElement = document.createElement('video');
  vidElement.setAttribute('autoplay', '');
  vidElement.setAttribute('muted', '');
  vidElement.srcObject = event.streams[0];

  var vidContainer = document.createElement('div');
  vidContainer.setAttribute('id', 'remoteVideo_' + peerUuid);
  vidContainer.setAttribute('class', 'videoContainer');
  vidContainer.appendChild(vidElement);
  vidContainer.appendChild(makeLabel(peerConnections[peerUuid].displayName));

  document.getElementById('videos').appendChild(vidContainer);

  updateLayout();
}

function checkPeerDisconnect(event, peerUuid) {
  var state = peerConnections[peerUuid].pc.iceConnectionState;
  console.log(`connection with peer ${peerUuid} ${state}`);
  if (state === "failed" || state === "closed" || state === "disconnected") {
    delete peerConnections[peerUuid];
    document.getElementById('videos').removeChild(document.getElementById('remoteVideo_' + peerUuid));
    updateLayout();
  }
}

function updateLayout() {
  // update CSS grid based on number of diplayed videos
  var rowHeight = '98vh';
  var colWidth = '98vw';

  var numVideos = Object.keys(peerConnections).length + 1; // add one to include local video

  if (numVideos > 1 && numVideos <= 4) { // 2x2 grid
    rowHeight = '48vh';
    colWidth = '48vw';
  } else if (numVideos > 4) { // 3x3 grid
    rowHeight = '32vh';
    colWidth = '32vw';
  }

  document.documentElement.style.setProperty(`--rowHeight`, rowHeight);
  document.documentElement.style.setProperty(`--colWidth`, colWidth);
}

function makeLabel(label) {
  var vidLabel = document.createElement('div');
  vidLabel.appendChild(document.createTextNode(label));
  vidLabel.setAttribute('class', 'videoLabel');
  return vidLabel;
}

function errorHandler(error) {
  console.log(error);
}
function gotMessageFromServer(message) {
 // var message= signal.val().message;
 console.log(message);
 var signal=JSON.parse(message._e.T);
 console.log(signal);
 
  var peerUuid = signal.uuid;

  // Ignore messages that are not for us or from ourselves
  if (peerUuid == localUuid || (signal.dest != localUuid && signal.dest != 'all')) return;

  if (signal.displayName && signal.dest == 'all') {
    // set up peer connection object for a newcomer peer
    setUpPeer(peerUuid, signal.displayName);
    io.sockets.in(room).emit('videomessage',JSON.stringify({ 'displayName': localDisplayName, 'uuid': localUuid, 'dest': peerUuid }));

  } else if (signal.displayName && signal.dest == localUuid) {
    // initiate call if we are the newcomer peer
    setUpPeer(peerUuid, signal.displayName, true);

  } else if (signal.sdp) {
    peerConnections[peerUuid].pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function () {
      // Only create answers in response to offers
      if (signal.sdp.type == 'offer') {
        peerConnections[peerUuid].pc.createAnswer().then(description => createdDescription(description, peerUuid)).then(() => sendMessage(localUuid, JSON.stringify({ 'displayName': localDisplayName, 'uuid': localUuid, 'dest': peerUuid }),localDisplayName));
      }
    }).catch(errorHandler);

  } else if (signal.ice) {
    peerConnections[peerUuid].pc.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
  }
}
async function sendVideo(users,room,username){
 //roomName = room;
 console.log(room);
var constraints = {
    video: {
      width: {max: 320},
      height: {max: 240},
      frameRate: {max: 30},
    },
    audio: true,
  };
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia(constraints)
      .then(stream => {
        localStream = stream;
        document.getElementById('yourVideo').srcObject = stream;
      }).catch(errorHandler);
        var elmnt = document.getElementById("videopanel");
        elmnt.scrollIntoView();
  } else {
    alert('Your browser does not support getUserMedia API');
  }
  await new Promise(resolve => setTimeout(resolve, 5000));
  console.log("length");
  console.log(users.length);
  if(users.length>1){
    setUpPeer(localUuid,username,true);
    socket.on('videomessage',message => {
    gotMessageFromServer(message);
  });
   io.sockets.in(room).emit('videomessage',JSON.stringify({ 'displayName': localDisplayName, 'uuid': localUuid, 'dest': 'all' }));

  }
  else
  {
  setUpPeer(localUuid,username,false);
  socket.on('videomessage',message => {
    gotMessageFromServer(message);
  });
  io.sockets.in(room).emit('videomessage',JSON.stringify({ 'displayName': localDisplayName, 'uuid': localUuid, 'dest': 'all' }));

  }
}


database.on('child_added', gotMessageFromServer);
//////////////////////////////////////////////////////////////////////////////////

// Get username and room from URL
socket.on('videomessage',message => {
    gotMessageFromServer(message);
  });
// Join chatroom
socket.emit('joinRoom', { username, room });


// Get room and users
socket.on('roomUsers', ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
  sendVideo(users,room,username);
});

// Message from server
socket.on('message', (message) => {
  console.log(message);
  outputMessage(message);

  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Message submit
chatForm.addEventListener('submit', (e) => {
  console.log(e)
  e.preventDefault();

  // Get message text
  let msg = e.target.elements.msg.value;

  msg = msg.trim();

  if (!msg) {
    return false;
  }

  // Emit message to server
  socket.emit('chatMessage', msg);

  // Clear input
  e.target.elements.msg.value = '';
  e.target.elements.msg.focus();
});

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement('div');
  div.classList.add('message');
  const p = document.createElement('p');
  p.classList.add('meta');
  p.innerText = message.username;
  p.innerHTML += `<span>${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement('p');
  para.classList.add('text');
  para.innerText = message.text;
  div.appendChild(para);
  document.querySelector('.chat-messages').appendChild(div);
}

// Add room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
  userList.innerHTML = '';
  users.forEach((user) => {
    const li = document.createElement('li');
    li.innerText = user.username;
    userList.appendChild(li);
  });
}

//Prompt the user before leave chat room
document.getElementById('leave-btn').addEventListener('click', () => {
  const leaveRoom = confirm('Are you sure you want to leave the chatroom?');
  if (leaveRoom) {
    window.location = '../index.html';
  } else {
  }
});

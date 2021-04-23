/////////////////////////////////////////Variables////////////////////////////////////////////////////////////////

const chatForm = document.getElementById("chat-form");
const chatMessages = document.querySelector(".chat-messages");
const roomName = document.getElementById("room-name");
const userList = document.getElementById("users");
//const video = require('./utils/video');
const socket = io();

var servers = {
  iceServers: [
    {
      urls: "stun:stun.services.mozilla.com",
    },
    {
      urls: "stun:stun.l.google.com:19302",
    },
    {
      urls: "turn:numb.viagenie.ca",
      credential: "Adhiksha@123",
      username: "adhikshat1905@gmail.com",
    },
  ],
};
// Get username and room from URL
const { username, room } = Qs.parse(location.search, {
  ignoreQueryPrefix: true,
});
var database;
const WS_PORT = 8443; //make sure this matches the port for the webscokets server
var yourVideo;
var friendsVideo;
var desc;
var localUuid;
var localDisplayName = username;
var localStream;
var serverConnection;
var peerConnections = {}; // key is uuid, values are peer connection object and user defined display name string
var peerUuid;
var connected = {};

var firebaseConfig = {
  apiKey: "AIzaSyBrJciZ3GS_tf9fpXZHXShQG6vGsM3FFDg",
  authDomain: "videochat-96f4e.firebaseapp.com",
  databaseURL: "https://videochat-96f4e.firebaseio.com",
  projectId: "videochat-96f4e",
  storageBucket: "videochat-96f4e.appspot.com",
  messagingSenderId: "110306645620",
  appId: "1:110306645620:web:6dae39c7ea8b530d02a321",
  measurementId: "G-4WHSVHFN7E",
};
//var firebase = require('firebase');
firebase.initializeApp(firebaseConfig);
var database = firebase.database().ref();

localUuid = Math.floor(Math.random() * 1000000000);

/////////////////////////////////////////Server Listeners////////////////////////////////////////////////////////////////

// Join chatroom

socket.on("room_full", (id) => {
  if (id == localUuid) {
    console.log("Room is full");
    alert("This room is full ! Maximum 4 people...");
    //window.location.href="/";
  }
});

socket.emit("joinRoom", { username, room });

// Get room and users
socket.on("roomUsers", ({ room, users }) => {
  outputRoomName(room);
  outputUsers(users);
  sendVideo(users, room, username);
});

// Message from server
socket.on("message", (message) => {
  //console.log(message);
  outputMessage(message);

  // Scroll down
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

/////////////////////////////////////////////////Element Listeners//////////////////////////////////////////////////////////

// Message submit
chatForm.addEventListener("submit", (e) => {
  console.log(e);
  e.preventDefault();

  // Get message text
  let msg = e.target.elements.msg.value;

  msg = msg.trim();

  if (!msg) {
    return false;
  }

  // Emit message to server
  socket.emit("chatMessage", msg);

  // Clear input
  e.target.elements.msg.value = "";
  e.target.elements.msg.focus();
});

document
  .getElementById("toggle-mute")
  .addEventListener("click", async function (e) {
    e.preventDefault();

    let elem = document.getElementById("toggle-mute");

    if (localStream.getAudioTracks()[0].enabled) {
      e.target.classList.remove("fa-microphone-alt");
      e.target.classList.add("fa-microphone-alt-slash");
      elem.setAttribute("title", "Unmute");

      localStream.getAudioTracks()[0].enabled = false;
    } else {
      e.target.classList.remove("fa-microphone-alt-slash");
      e.target.classList.add("fa-microphone-alt");
      elem.setAttribute("title", "Mute");

      localStream.getAudioTracks()[0].enabled = true;
    }

    //broadcastNewTracks( localStream, 'audio' );
  });

document.getElementById("toggle-video").addEventListener("click", (e) => {
  e.preventDefault();

  let elem = document.getElementById("toggle-video");

  if (localStream.getVideoTracks()[0].enabled) {
    e.target.classList.remove("fa-video");
    e.target.classList.add("fa-video-slash");
    elem.setAttribute("title", "Show Video");

    localStream.getVideoTracks()[0].enabled = false;
  } else {
    e.target.classList.remove("fa-video-slash");
    e.target.classList.add("fa-video");
    elem.setAttribute("title", "Hide Video");

    localStream.getVideoTracks()[0].enabled = true;
  }

  broadcastNewTracks(localStream, "video");
});

/////////////////////////////////////////////////Functions//////////////////////////////////////////////////////////

function setUpPeer(peerUuid, displayName, initCall = false) {
  if (peerUuid in connected) return;
  peerConnections[peerUuid] = {
    uuid: peerUuid,
    pc: new RTCPeerConnection(servers),
    displayName: displayName,
  };
  peerConnections[peerUuid].pc.onicecandidate = (event) =>
    gotIceCandidate(event, peerUuid);
  peerConnections[peerUuid].pc.ontrack = (event) =>
    gotRemoteStream(event, peerUuid);
  peerConnections[peerUuid].pc.oniceconnectionstatechange = (event) =>
    checkPeerDisconnect(event, peerUuid);
  peerConnections[peerUuid].pc.addStream(localStream);

  if (initCall) {
    peerConnections[peerUuid].pc
      .createOffer()
      .then((description) => createdDescription(description, peerUuid))
      .catch(errorHandler);
  }
}
function errorHandler(error) {
  console.log(error);
}

function sendMessage(sender, msg, name) {
  var x = database.push(
    JSON.stringify({
      uuid: sender,
      message: msg,
      displayName: name,
    })
  );
  //console.log(x);
  peerUuid = sender;
  x.remove();
}

function gotIceCandidate(event, peerUuid) {
  if (event.candidate != null) {
    console.log(room);
    socket.emit(
      "videomessage",
      JSON.stringify({ ice: event.candidate, uuid: localUuid, dest: peerUuid })
    );
    // sendMessage(localUuid,JSON.stringify({'ice': event.candidate}),localDisplayName);
  }
}

function createdDescription(description, peerUuid) {
  console.log(`got description, peer ${peerUuid}`);
  peerConnections[peerUuid].pc
    .setLocalDescription(description)
    .then(function () {
      socket.emit(
        "videomessage",
        JSON.stringify({
          sdp: peerConnections[peerUuid].pc.localDescription,
          uuid: localUuid,
          dest: peerUuid,
        })
      );
    })
    .catch(errorHandler);
}

async function gotRemoteStream(event, peerUuid) {
  console.log(`got remote stream, peer ${peerUuid}`);
  //assign stream to new HTML video element
  connected[peerUuid] = 1;
  //console.log('without return');
  var vidElement = document.createElement("video");
  vidElement.setAttribute("autoplay", "");
  vidElement.setAttribute("muted", "");
  vidElement.setAttribute("class", "videoele");
  vidElement.srcObject = event.streams[0];

  var vidContainer = document.createElement("div");
  vidContainer.setAttribute("id", "remoteVideo_" + peerUuid);
  vidContainer.setAttribute("class", "videoContainer");
  vidContainer.appendChild(vidElement);
  vidContainer.appendChild(makeLabel(peerConnections[peerUuid].displayName));
  document.getElementById("videos").appendChild(vidContainer);

  updateLayout();
}

function checkPeerDisconnect(event, peerUuid) {
  var state = peerConnections[peerUuid].pc.iceConnectionState;
  console.log(`connection with peer ${peerUuid} ${state}`);
  if (
    state === "failed" ||
    state === "closed" ||
    state === "disconnected" ||
    state === "connected"
  ) {
    delete peerConnections[peerUuid];
    document
      .getElementById("videos")
      .removeChild(document.getElementById("remoteVideo_" + peerUuid));
    updateLayout();
  }
}
/*
function updateLayout() {
  // update CSS grid based on number of diplayed videos
  var rowHeight = '50vh';
  var colWidth = '50vw';
  var videopanel = document.getElementById("videos");
    var videos = document.getElementsByTagName("video"); // get all current videos
   var numVideos = videos.length;
   console.log(numVideos);
   var videocont = document.getElementsByName('remoteVideo');
   console.log(videocont);
  if(numVideos==2){
    videopanel.className= "video-chat-container-two";
    var local = document.getElementsByName("videopanel");
    videocont[0].className="remote-video-two";
    local[0].className="local-video-two";
    videocont[0].setAttribute("name","firstremote");
  }
    
  else if (numVideos >= 3 && numVideos <= 4) { // 2x2 grid
    videopanel.className = "videos" ;
    var local = document.getElementsByName("videopanel");
    var remote = document.getElementsByName("firstremote");
    if(local!=null&&remote!=null)
    {
    local[0].className ="videoContainer" ;
    remote[0].className = "videoContainer";
    }
    rowHeight = '25vh';
    colWidth = '25vw';
  } 
  else if (numVideos > 4) { // 3x3 grid
    rowHeight = '20vh';
    colWidth = '20vw';
  }

  document.documentElement.style.setProperty(`--rowHeight`, rowHeight);
  document.documentElement.style.setProperty(`--colWidth`, colWidth);
}
*/
function updateLayout() {
  // update CSS grid based on number of diplayed videos
  var rowHeight = "50vh";
  var colWidth = "50vw";

  var numVideos = document.getElementsByTagName("video").length; // add one to include local video

  if (numVideos > 1 && numVideos <= 4) {
    // 2x2 grid
    rowHeight = "25vh";
    colWidth = "25vw";
  } else if (numVideos > 4) {
    // 3x3 grid
    rowHeight = "32vh";
    colWidth = "32vw";
  }

  document.documentElement.style.setProperty(`--rowHeight`, rowHeight);
  document.documentElement.style.setProperty(`--colWidth`, colWidth);
}

function makeLabel(label) {
  var vidLabel = document.createElement("div");
  vidLabel.appendChild(document.createTextNode(label));
  vidLabel.setAttribute("class", "videoLabel");
  return vidLabel;
}

function errorHandler(error) {
  console.log(error);
}
async function gotMessageFromServer(message) {
  // var message= signal.val().message;
  //console.log(message);
  var signal = JSON.parse(message);
  console.log(signal);

  var peerUuid = signal.uuid;

  // Ignore messages that are not for us or from ourselves
  if (
    peerUuid == localUuid ||
    (signal.dest != localUuid && signal.dest != "all")
  )
    return;

  if (signal.displayName && signal.dest == "all" && signal.uuid) {
    // set up peer connection object for a newcomer peer
    setUpPeer(peerUuid, signal.displayName);
    socket.emit(
      "videomessage",
      JSON.stringify({
        displayName: localDisplayName,
        uuid: localUuid,
        dest: peerUuid,
      })
    );
  } else if (signal.displayName && signal.dest == localUuid) {
    // initiate call if we are the newcomer peer
    setUpPeer(peerUuid, signal.displayName, true);
  } else if (signal.sdp) {
    peerConnections[peerUuid].pc
      .setRemoteDescription(new RTCSessionDescription(signal.sdp))
      .then(async function () {
        // Only create answers in response to offers
        if (signal.sdp.type == "offer") {
          peerConnections[peerUuid].pc
            .createAnswer()
            .then((description) => createdDescription(description, peerUuid));
        } else if (signal.sdp.type === "answer") {
          await peerConnections[peerUuid].pc.setRemoteDescription(
            new RTCSessionDescription(data.sdp)
          );
        }
      })
      .catch(errorHandler);
  } else if (signal.ice) {
    if (peerConnections[peerUuid] != undefined)
      peerConnections[peerUuid].pc
        .addIceCandidate(new RTCIceCandidate(signal.ice))
        .catch(errorHandler);
  }
}
async function sendVideo(users, room, username) {
  //roomName = room;
  console.log(room);
  var constraints = {
    video: {
      width: { max: 320 },
      height: { max: 240 },
      frameRate: { max: 30 },
    },
    audio: true,
  };
  if (navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        localStream = stream;
        document.getElementById("yourVideo").srcObject = stream;
      })
      .catch(errorHandler);
    var elmnt = document.getElementById("videopanel");
    elmnt.scrollIntoView();
  } else {
    alert("Your browser does not support getUserMedia API");
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
  //console.log("length");
  //console.log(users.length);
  if (users.length > 4) {
    socket.emit("full_room", localUuid);
  } else if (users.length > 1) {
    //setUpPeer(localUuid,username,true);
    socket.on("vmessage", async function (message) {
      //console.log('vmessage recieved');
      gotMessageFromServer(message);
    });
    socket.emit(
      "videomessage",
      JSON.stringify({
        displayName: localDisplayName,
        uuid: localUuid,
        dest: "all",
      })
    );
  } else {
    setUpPeer(localUuid, username, false);
    socket.on("vmessage", async function (message) {
      //console.log('vmessage recieved');
      gotMessageFromServer(message);
    });
    socket.emit(
      "videomessage",
      JSON.stringify({
        displayName: localDisplayName,
        uuid: localUuid,
        dest: "all",
      })
    );
  }
}

// Output message to DOM
function outputMessage(message) {
  const div = document.createElement("div");
  div.classList.add("message");
  const p = document.createElement("p");
  p.classList.add("meta");
  p.innerText = message.username;
  p.innerHTML += `<span>${message.time}</span>`;
  div.appendChild(p);
  const para = document.createElement("p");
  para.classList.add("text");
  para.innerText = message.text;
  div.appendChild(para);
  document.querySelector(".chat-messages").appendChild(div);
}

// Add room name to DOM
function outputRoomName(room) {
  roomName.innerText = room;
}

// Add users to DOM
function outputUsers(users) {
  userList.innerHTML = "";
  users.forEach((user) => {
    const li = document.createElement("li");
    li.innerText = user.username;
    li.style.background = "lightgray";
    const icon = document.createElement("span");
    icon.classList.add("fa");
    icon.classList.add("fa-circle");
    icon.style.float = "right";
    icon.style.color = "lightgreen";
    icon.size = "10px";
    li.appendChild(icon);
    userList.appendChild(li);
  });
}

//Prompt the user before leave chat room
document.getElementById("leave-btn").addEventListener("click", () => {
  const leaveRoom = confirm("Are you sure you want to leave the chatroom?");
  if (leaveRoom) {
    window.location = "../index.html";
  } else {
  }
});

function broadcastNewTracks(stream, type, mirrorMode = true) {
  h.setLocalStream(stream, mirrorMode);

  let track =
    type == "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

  for (let p in peerConnections) {
    let pName = peerConnections[p];

    if (typeof peerConnections[pName] == "object") {
      h.replaceTrack(track, peerConnections[pName]);
    }
  }
}

//Toggle chat & sidebar:
function toggleElement(element) {
  const isOpen = !element.classList.contains("hidden");

  if (isOpen) {
    element.classList.add("hidden");
    return;
  }

  element.classList.remove("hidden");
}

function toggleChat() {
  const chatContainer = document.querySelector(".chat-message-box");
  toggleElement(chatContainer);

  //toogle the "show users" btn:
  const showUserBtn = document.querySelector("#show-chat-btn");
  toggleElement(showUserBtn);
}

function toggleSidebar() {
  const sideBar = document.querySelector(".chat-sidebar");
  toggleElement(sideBar);

  //toogle the "show chat" btn:
  const showUserBtn = document.querySelector("#show-users-btn");
  toggleElement(showUserBtn);
}

function handleToggleBtnPress() {
  toggleSidebar();
  toggleChat();
}

document.querySelector("#show-users-btn").addEventListener("click", () => {
  handleToggleBtnPress();
});

document.querySelector("#show-chat-btn").addEventListener("click", () => {
  handleToggleBtnPress();
});

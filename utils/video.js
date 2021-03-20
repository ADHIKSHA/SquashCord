const https = require('https');

function sendVideo(username){
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

}
module.exports = sendVideo;
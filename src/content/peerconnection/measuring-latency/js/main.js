/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

var startButton = document.getElementById('startButton');
var callButton = document.getElementById('callButton');
var hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;
startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;

var startTime;
var localVideo = document.getElementById('localVideo');
var remoteVideo = document.getElementById('remoteVideo');
var canvas = document.getElementById('canvas');

localVideo.addEventListener('loadedmetadata', function() {
  trace('Local video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.addEventListener('loadedmetadata', function() {
  trace('Remote video videoWidth: ' + this.videoWidth +
    'px,  videoHeight: ' + this.videoHeight + 'px');
});

remoteVideo.onresize = function() {
  trace('Remote video size changed to ' +
    remoteVideo.videoWidth + 'x' + remoteVideo.videoHeight);
  // We'll use the first onsize callback as an indication that video has started
  // playing out.
  if (startTime) {
    var elapsedTime = window.performance.now() - startTime;
    trace('Setup time: ' + elapsedTime.toFixed(3) + 'ms');
    startTime = null;
  }
};

try {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  window.audioContext = new AudioContext();
} catch (e) {
  alert('Web Audio API not supported.');
}

var localStream;
var localChannel;
var localChannelTimestamp;
var pc1;
var pc2;
var offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

function getName(pc) {
  return (pc === pc1) ? 'pc1' : 'pc2';
}

function getOtherPc(pc) {
  return (pc === pc1) ? pc2 : pc1;
}

var localSoundMeter
function gotStream(stream) {
  trace('Received local stream');
  localVideo.srcObject = stream;
  localStream = stream;
  callButton.disabled = false;

  localSoundMeter = new SoundMeter(window.audioContext);
  localSoundMeter.connectToSource(stream, function(e) {
    if (e) {
      alert(e);
      return;
    }
  });
}

function start() {
  trace('Requesting local stream');
  startButton.disabled = true;
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: { width: 640, height: 480 }
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e);
  });
}

var startTimestamp;
function call() {
  startTimestamp = window.performance.now();
  callButton.disabled = true;
  hangupButton.disabled = false;
  trace('Starting call');
  startTime = window.performance.now();
  var videoTracks = localStream.getVideoTracks();
  var audioTracks = localStream.getAudioTracks();
  if (videoTracks.length > 0) {
    trace('Using video device: ' + videoTracks[0].label);
  }
  if (audioTracks.length > 0) {
    trace('Using audio device: ' + audioTracks[0].label);
  }
  var servers = null;
  pc1 = new RTCPeerConnection(servers);
  trace('Created local peer connection object pc1');
  pc1.onicecandidate = function(e) {
    onIceCandidate(pc1, e);
  };
  pc2 = new RTCPeerConnection(servers);
  trace('Created remote peer connection object pc2');
  pc2.onicecandidate = function(e) {
    onIceCandidate(pc2, e);
  };
  pc1.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc1, e);
  };
  pc2.oniceconnectionstatechange = function(e) {
    onIceStateChange(pc2, e);
  };
  pc2.onaddstream = gotRemoteStream;
  pc2.ontrack = gotRemoteTrack;
  pc2.ondatachannel = (event) => {
      document.getElementById("start").innerHTML = ((window.performance.now() - startTimestamp) / 1000).toFixed(3);
      event.channel.onmessage = (message) => {
        document.getElementById("dataLatency").innerHTML = ((window.performance.now() - localChannelTimestamp) / 1000).toFixed(3);
      }
  };

  localChannel = pc1.createDataChannel("test");
  localChannel.onopen = () => { console.log("starting data channel"); sendMessage(); };

  pc1.addStream(localStream);
  trace('Added local stream to pc1');

  trace('pc1 createOffer start');
  pc1.createOffer(
    offerOptions
  ).then(
    onCreateOfferSuccess,
    onCreateSessionDescriptionError
  );
}

function sendMessage()
{
    if (localChannel.readyState !== "open")
        return;
    localChannelTimestamp = window.performance.now();
    localChannel.send("Data channel latency message");
    setTimeout(sendMessage, 500);
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function onCreateOfferSuccess(desc) {
  trace('Offer from pc1\n' + desc.sdp);
  trace('pc1 setLocalDescription start');
  pc1.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(pc1);
    },
    onSetSessionDescriptionError
  );
  trace('pc2 setRemoteDescription start');
  pc2.setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(pc2);
    },
    onSetSessionDescriptionError
  );
  trace('pc2 createAnswer start');
  // Since the 'remote' side has no media stream we need
  // to pass in the right constraints in order for it to
  // accept the incoming offer of audio and video.
  pc2.createAnswer().then(
    onCreateAnswerSuccess,
    onCreateSessionDescriptionError
  );
}

function onSetLocalSuccess(pc) {
  trace(getName(pc) + ' setLocalDescription complete');
}

function onSetRemoteSuccess(pc) {
  trace(getName(pc) + ' setRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}

function gotRemoteTrack(e) {
  //remoteVideo.srcObject = e.streams[0];
  trace('pc2 received remote track');
}

var remoteSoundMeter;
function gotRemoteStream(e) {
  remoteVideo.srcObject = e.stream;
  trace('pc2 received remote stream');

  remoteSoundMeter = new SoundMeter(window.audioContext);
  remoteSoundMeter.connectToSource(e.stream, function(e) {
    if (e) {
      alert(e);
      return;
    }
  });
  remoteVideo.onplay = () => { window.requestAnimationFrame(detectChanges); };
}

function detectChanges()
{
    detectLocalClapping();
    detectRemoteTracksChanges();
    window.requestAnimationFrame(detectChanges);
}

var isLocalClapping = true;
var localClappingTimestamp;
var clappingThreshold = 0.05;
var isLocalRed = true;
var lastDetectionTimestamp = 0;
function detectLocalClapping()
{
    if (isLocalClapping) {
        if (localSoundMeter.instant.toFixed(2) < clappingThreshold) {
            isLocalClapping = false;
            trace("end of local clapping");
        }
    } else {
        if (localSoundMeter.instant.toFixed(2) > clappingThreshold) {
            localClappingTimestamp = window.performance.now();
            isLocalClapping = true;
            trace("start of local clapping");
            trace("setting enabled video track to " + !localStream.getVideoTracks()[0].enabled);
            localStream.getVideoTracks()[0].enabled = !localStream.getVideoTracks()[0].enabled;
            localVideo.style.borderColor = "green";
            isLocalRed = !isLocalRed;
            localVideo.style.borderColor = isLocalRed ? "red" : "green";
            document.getElementById("uncertainty").innerHTML = 2 * ((window.performance.now() - lastDetectionTimestamp) / 1000).toFixed(3);
        }
    }
    lastDetectionTimestamp = window.performance.now();
}

function isBlackFrame(canvas)
{
    var data = canvas.getContext('2d').getImageData(0, 0, 50, 50).data;
    for (var cptr = 0; cptr < data.length / 4; ++cptr) {
        if (data[4 * cptr] > 10 || data[4 * cptr + 1] > 10 || data[4 * cptr + 2] > 10 || data[4 * cptr + 3] != 255) {
            return false;
        }
    }
    return true;
}

var audioLatency = 0;
var videoLatency = 0;
var isRemoteVideoTrackBlack = false;
var isRemoteClapping = false;
var isRemoteRed = true;
function detectRemoteTracksChanges()
{
    canvas.getContext('2d').drawImage(remoteVideo, 0, 0, 640, 480);
    if (isRemoteVideoTrackBlack != isBlackFrame(canvas)) {
        videoLatency = window.performance.now() - localClappingTimestamp;
        document.getElementById("videoLatency").innerHTML = (videoLatency / 1000).toFixed(3);
        document.getElementById("avSync").innerHTML = ((videoLatency - audioLatency) / 1000).toFixed(3);
        isRemoteVideoTrackBlack = !isRemoteVideoTrackBlack;
        trace('got ' + (isRemoteVideoTrackBlack ? 'black' : 'real') + ' frame');
    }
    if (isRemoteClapping) {
        if (remoteSoundMeter.instant.toFixed(2) < clappingThreshold) {
            isRemoteClapping = false;
            trace("end of remote clapping");
        }
    } else {
        if (remoteSoundMeter.instant.toFixed(2) > clappingThreshold) {
            audioLatency = window.performance.now() - localClappingTimestamp;
            document.getElementById("audioLatency").innerHTML = ((audioLatency) / 1000).toFixed(3);
            document.getElementById("avSync").innerHTML = ((videoLatency - audioLatency) / 1000).toFixed(3);
            isRemoteClapping = true;
            trace("start of remote clapping");
            isRemoteRed = !isRemoteRed;
            remoteVideo.style.borderColor = isRemoteRed ? "red" : "green";
        }
    }
}

function onCreateAnswerSuccess(desc) {
  trace('Answer from pc2:\n' + desc.sdp);
  trace('pc2 setLocalDescription start');
  pc2.setLocalDescription(desc).then(
    function() {
      onSetLocalSuccess(pc2);
    },
    onSetSessionDescriptionError
  );
  trace('pc1 setRemoteDescription start');
  pc1.setRemoteDescription(desc).then(
    function() {
      onSetRemoteSuccess(pc1);
    },
    onSetSessionDescriptionError
  );
}

function onIceCandidate(pc, event) {
  getOtherPc(pc).addIceCandidate(event.candidate)
  .then(
    function() {
      onAddIceCandidateSuccess(pc);
    },
    function(err) {
      onAddIceCandidateError(pc, err);
    }
  );
  trace(getName(pc) + ' ICE candidate: \n' + (event.candidate ?
      event.candidate.candidate : '(null)'));
}

function onAddIceCandidateSuccess(pc) {
  trace(getName(pc) + ' addIceCandidate success');
}

function onAddIceCandidateError(pc, error) {
  trace(getName(pc) + ' failed to add ICE Candidate: ' + error.toString());
}

function onIceStateChange(pc, event) {
  if (pc) {
    trace(getName(pc) + ' ICE state: ' + pc.iceConnectionState);
    console.log('ICE state change event: ', event);
  }
}

function hangup() {
  trace('Ending call');
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}

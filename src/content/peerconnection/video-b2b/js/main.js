/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
/* global TimelineDataSeries, TimelineGraphView */

'use strict';

var video1 = document.querySelector('video#video1');
var video2 = document.querySelector('video#video2');
var callButton = document.querySelector('button#callButton');
var hangupButton = document.querySelector('button#hangupButton');
hangupButton.disabled = true;
callButton.onclick = call;
hangupButton.onclick = hangup;

var pc;
var localStream;
var isCalling = false;

var socket = io('/');
socket.on('connect', function () {
    console.log('connected');
    socket.on('message', function (msg) {
        console.log(msg);
        var message = JSON.parse(msg);
        if ((message.type === "callingCandidate" && !isCalling) || (message.type === "calledCandidate" && isCalling)) {
          trace('Remote ICE candidate: \n' + JSON.stringify(message.data));
          if (message.data) {
            var candidate = new RTCIceCandidate(message.data);
            pc.addIceCandidate(candidate).then(onAddIceCandidateSuccess, onAddIceCandidateError);
          }
        } else if (message.type === "offer") {
          pc.setRemoteDescription(message.data).then(() => {
            return pc.createAnswer();
          }, onSetSessionDescriptionError).then(desc => {
            pc.setLocalDescription(desc);
            socket.send(JSON.stringify({"type": "answer", data: desc}));
          }, onCreateSessionDescriptionError);
        }
        else if (message.type === "answer")
            pc.setRemoteDescription(message.data).then(function() { }, onSetSessionDescriptionError);
     });
});

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

trace('Created peer connection object pc');
pc = new RTCPeerConnection();
pc.onicecandidate = iceCallback;
pc.onaddstream = gotRemoteStream;

function capture()
{
  trace('Requesting local stream');
  navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(gotStream).catch(function(e) {
    alert('getUserMedia() error: ' + e);
  });
}

function gotStream(stream) {
  callButton.disabled = false;
  trace('Received local stream');
  localStream = stream;

  video1.srcObject = localStream;
  pc.addStream(localStream);
}

function call() {
  isCalling = true;
  hangupButton.disabled = false;
  callButton.disabled = true;
  trace('Starting call');

  var videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    trace('Using Video device: ' + videoTracks[0].label);
  }
  trace('Adding Local Stream to peer connection');

  pc.createOffer().then((desc) => {
    pc.setLocalDescription(desc).then(() => {
      socket.send(JSON.stringify({"type": "offer", data: desc}));
    }, onSetSessionDescriptionError);
  },onCreateSessionDescriptionError);
}

function hangup() {
  trace('Ending call');
  localStream.getTracks().forEach(function(track) {
    track.stop();
  });
  pc.close();
  pc = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}

function gotRemoteStream(e) {
  video2.srcObject = e.stream;
  trace('Received remote stream');
}

function iceCallback(event) {
  trace('Local ICE candidate: \n' + JSON.stringify(event.candidate));
  socket.send(JSON.stringify({ "type": (isCalling ? "callingCandidate" : "calledCandidate"), data: event.candidate }));
}

function onAddIceCandidateSuccess() {
  trace('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
  trace('Failed to add ICE Candidate: ' + error.toString());
}

function onSetSessionDescriptionError(error) {
  trace('Failed to set session description: ' + error.toString());
}

capture();

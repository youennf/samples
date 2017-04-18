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
var dataButton = document.querySelector('button#dataToggle');
var audioButton = document.querySelector('button#audioToggle');
var videoButton = document.querySelector('button#videoToggle');
var stateDiv = document.querySelector('div#state');
hangupButton.disabled = true;
callButton.onclick = call;
hangupButton.onclick = hangup;
dataButton.onclick = toggleData;
audioButton.onclick = toggleAudio;
videoButton.onclick = toggleVideo;

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
          video2.setAttribute("class", "connecting");
          pc.setRemoteDescription(message.data).then(() => {
            addMediaData();
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
  navigator.mediaDevices.getUserMedia({ audio: true, video: {width: 640, height: 480} }).then(gotStream).catch(function(e) {
    alert('getUserMedia() error: ' + e);
  });
}

function gotStream(stream) {
  callButton.disabled = false;
  trace('Received local stream');
  localStream = stream;

  video1.srcObject = localStream;
}

function updateState()
{
    if (stateDiv.innerHTML)
        stateDiv.innerHTML += ", ";
    stateDiv.innerHTML += pc.iceConnectionState;
    if (pc.connectionState)
        stateDiv.innerHTML +=  "/" + pc.connectionState;
}


var reachedConnected = false;
pc.oniceconnectionstatechange = () => {
    updateState();
    if (pc.iceConnectionState == "closed") {
        video2.removeAttribute("class");
        return;
    }
    if (pc.iceConnectionState == "connected")
        reachedConnected = true;
    else if (pc.iceConnectionState == "failed" || pc.iceConnectionState == "disconnected")
        reachedConnected = false;
    var isConnected = pc.iceConnectionState == "connected" || (pc.iceConnectionState == "completed" && reachedConnected);
    video2.setAttribute("class", isConnected ? "connected" : "connecting");
}

pc.onconnectionstatechange = () => {
    updateState();
}

var useData = true;
function toggleData()
{
    useData = !useData;
    dataButton.innerHTML = useData ? "Data" : "No data";
}

var useAudio = true;
function toggleAudio()
{
    useAudio = !useAudio;
    audioButton.innerHTML = useAudio ? "Audio" : "No audio";
}

var useVideo = true;
function toggleVideo()
{
    useVideo = !useVideo;
    videoButton.innerHTML = useVideo ? "Video" : "No video";
}

function addMediaData()
{
  if (useAudio && useVideo)
      pc.addStream(localStream);
  else if (useVideo)
    pc.addStream(new MediaStream([localStream.getVideoTracks()[0]]));
  else if(useAudio)
    pc.addStream(new MediaStream([localStream.getAudioTracks()[0]]));
  if (useData)
      pc.createDataChannel("data channel");
}

function call() {
  isCalling = true;
  hangupButton.disabled = false;
  callButton.disabled = true;
  trace('Starting call');

  video2.setAttribute("class", "connecting");
  var videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    trace('Using Video device: ' + videoTracks[0].label);
  }
  trace('Adding Local Stream to peer connection');
  addMediaData();
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

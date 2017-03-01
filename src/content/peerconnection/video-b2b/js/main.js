/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
/* global TimelineDataSeries, TimelineGraphView */

'use strict';

var video = document.querySelector('video#video');
var callButton = document.querySelector('button#callButton');
var showLocalButton = document.querySelector('button#showLocalButton');
var hangupButton = document.querySelector('button#hangupButton');
var codecSelector = document.querySelector('select#codec');
hangupButton.disabled = true;
callButton.onclick = call;
showLocalButton.onclick = showLocal;
hangupButton.onclick = hangup;

var pc1;
var pc2;
var localStream;

var bitrateGraph;
var bitrateSeries;

var packetGraph;
var packetSeries;

var lastResult;

var candidates = [];
var needsStoringCandidates = true;

var socket = io('/');
socket.on('connect', function () {
    console.log('connected');
    socket.on('message', function (msg) {
        trace(msg);
        var message = JSON.parse(msg);
        if (message.type === "iceCandidate1") {
            console.log(needsStoringCandidates);
            if (needsStoringCandidates)
                candidates.push(new RTCIceCandidate(message.data));
            else
                pc2.addIceCandidate(new RTCIceCandidate(message.data)).then(onAddIceCandidateSuccess, onAddIceCandidateError);
        }
        else if (message.type === "iceCandidate2")
          pc1.addIceCandidate(new RTCIceCandidate(message.data)).then(onAddIceCandidateSuccess, onAddIceCandidateError);
      else if (message.type === "gotDescription1") {
            init();
            pc2.setRemoteDescription(new RTCSessionDescription(message.data)).then(function() {
                pc2.createAnswer().then(gotDescription2, onCreateSessionDescriptionError);
            }, onSetSessionDescriptionError);
        }
        else if (message.type === "gotDescription2")
            pc1.setRemoteDescription(new RTCSessionDescription(message.data)).then(function() { }, onSetSessionDescriptionError);
     });
});

function gotStream(stream) {
  init();
  hangupButton.disabled = false;
  trace('Received local stream');
  localStream = stream;
  var videoTracks = localStream.getVideoTracks();
  if (videoTracks.length > 0) {
    trace('Using Video device: ' + videoTracks[0].label);
  }
  pc1.addStream(localStream);
  trace('Adding Local Stream to peer connection');

  pc1.createOffer().then(
    gotDescription1,
    onCreateSessionDescriptionError
  );

  bitrateSeries = new TimelineDataSeries();
  bitrateGraph = new TimelineGraphView('bitrateGraph', 'bitrateCanvas');
  bitrateGraph.updateEndDate();

  packetSeries = new TimelineDataSeries();
  packetGraph = new TimelineGraphView('packetGraph', 'packetCanvas');
  packetGraph.updateEndDate();
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function init() {
  var servers = null;
  var pcConstraints = {
    'optional': []
  };
  pc1 = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  trace('Created local peer connection object pc1');
  pc1.onicecandidate = iceCallback1;
  pc2 = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
  trace('Created remote peer connection object pc2');
  pc2.onicecandidate = iceCallback2;
  pc2.onaddstream = gotRemoteStream;
  pc2.onsignalingstatechange = (e) => { trace("pc2.onsignalingstatechange " + pc2.signalingState + " " + JSON.stringify(e)); };
  pc2.oniceconnectionstatechange = (e) => { trace("pc2.oniceconnectionstatechange " + pc2.iceConnectionState + " " + JSON.stringify(e)); };
  pc2.onicegatheringstatechange = (e) => { trace("pc2.onicegatheringstatechange " + pc2.iceGatheringState + " " + JSON.stringify(e)); };
}

function call() {
  callButton.disabled = true;
  codecSelector.disabled = true;
  trace('Starting call');
  trace('Requesting local stream');
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: true
  })
  .then(gotStream)
  .catch(function(e) {
    alert('getUserMedia() error: ' + e);
  });
}

function gotDescription1(desc) {
  trace('Offer from pc1 \n' + desc.sdp);
  pc1.setLocalDescription(desc).then(
    function() {
      socket.send(JSON.stringify({"type": "gotDescription1", data: desc}));
    },
    onSetSessionDescriptionError
  );
}

function gotDescription2(desc) {
  trace('Answer from pc2 \n' + JSON.stringify({"type": "gotDescription2", data: desc}));
      socket.send(JSON.stringify({"type": "gotDescription2", data: desc}));
      trace('Sent gotDescription2 \n');

      pc2.setLocalDescription(desc).then(
    function() {
     trace('Sending gotDescription2 \n');
     needsStoringCandidates = false;
     for(var c of candidates)
         pc2.addIceCandidate(c).then(onAddIceCandidateSuccess, onAddIceCandidateError);
     candidates = [];
    },
    onSetSessionDescriptionError
  );
}

function hangup() {
  trace('Ending call');
  localStream.getTracks().forEach(function(track) {
    track.stop();
  });
  pc1.close();
  pc2.close();
  pc1 = null;
  pc2 = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  codecSelector.disabled = false;
}

function gotRemoteStream(e) {
  trace('Received remote stream');
  console.log(JSON.stringify(e.stream.getVideoTracks()));
  trace(JSON.stringify(e));
  video.srcObject = e.stream;
}

function showLocal() {
    if (!localStream) {
        trace("no local video stream");
        return;
    }
    video.srcObject = localStream;
}

function iceCallback1(event) {
  if (event.candidate) {
    trace('Local ICE candidate: \n' + event.candidate.candidate);
    socket.send(JSON.stringify({"type": "iceCandidate1", data: event.candidate}))
  }
}

function iceCallback2(event) {
  if (event.candidate) {
    trace('Remote ICE candidate: \n ' + event.candidate.candidate);
    socket.send(JSON.stringify({"type": "iceCandidate2", data: event.candidate}))
  }
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

// query getStats every second
window.setInterval(function() {
  if (!window.pc1) {
    return;
  }
  window.pc1.getStats(null).then(function(res) {
    Object.keys(res).forEach(function(key) {
      var report = res[key];
      var bytes;
      var packets;
      var now = report.timestamp;
      if ((report.type === 'outboundrtp') ||
          (report.type === 'outbound-rtp') ||
          (report.type === 'ssrc' && report.bytesSent)) {
        bytes = report.bytesSent;
        packets = report.packetsSent;
        if (lastResult && lastResult[report.id]) {
          // calculate bitrate
          var bitrate = 8 * (bytes - lastResult[report.id].bytesSent) /
              (now - lastResult[report.id].timestamp);

          // append to chart
          bitrateSeries.addPoint(now, bitrate);
          bitrateGraph.setDataSeries([bitrateSeries]);
          bitrateGraph.updateEndDate();

          // calculate number of packets and append to chart
          packetSeries.addPoint(now, packets -
              lastResult[report.id].packetsSent);
          packetGraph.setDataSeries([packetSeries]);
          packetGraph.updateEndDate();
        }
      }
    });
    lastResult = res;
  });
}, 1000);

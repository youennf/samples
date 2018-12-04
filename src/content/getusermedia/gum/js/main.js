/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

var errorElement = document.querySelector('#errorMsg');
var video = document.querySelector('video');

// Put variables in global scope to make them available to the browser console.
var constraints = window.constraints = {
    audio: true,
  video: true
};

function handleSuccess(stream) {
  var videoTrack = stream.getVideoTracks()[0];
console.log(JSON.stringify(videoTrack.getSettings()));
  console.log('Got stream with constraints:', constraints);
  console.log('Using video device: ' + videoTrack.label);
  stream.oninactive = function() {
    console.log('Stream inactive');
  };
  window.stream = stream; // make variable available to browser console
  video.srcObject = stream;
  video.play().then(() => {
      console.log("size:" + video.videoWidth + ", " + video.videoHeight);
  })
  stream.getAudioTracks()[0].applyConstraints({echoCancellation: false, volume: 0.1, sampleRate: 48000}).then(() => console.log(stream.getAudioTracks()[0].getSettings()), (e1, e2) => console.log("error" + e1 + "/" + e2));
alert("orientation:" + window.orientation);
}

function handleError(error) {
  if (error.name === 'ConstraintNotSatisfiedError') {
    errorMsg('The resolution ' + constraints.video.width.exact + 'x' +
        constraints.video.width.exact + ' px is not supported by your device.');
  } else if (error.name === 'PermissionDeniedError') {
    errorMsg('Permissions have not been granted to use your camera and ' +
      'microphone, you need to allow the page access to your devices in ' +
      'order for the demo to work.');
  }
  errorMsg('getUserMedia error: ' + error.name, error);
}

function errorMsg(msg, error) {
  errorElement.innerHTML += '<p>' + msg + '</p>';
  if (typeof error !== 'undefined') {
    console.error(error);
  }
}

if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    alert("getUserMedia is not available");

navigator.mediaDevices.getUserMedia(constraints).
    then(handleSuccess).catch(handleError);

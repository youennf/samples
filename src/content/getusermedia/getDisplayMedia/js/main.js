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

var captureButton = document.querySelector('#capture');
captureButton.onclick = function() {
  capture();
};


function handleSuccess(stream) {
  var videoTrack = stream.getVideoTracks()[0];
  window.stream = stream; // make variable available to browser console
  video.srcObject = stream;
  video.play().then(() => {
      console.log("size:" + video.videoWidth + ", " + video.videoHeight);
  })
}

function handleError(error) {
  errorMsg('getDisplayMedia error: ' + error.name, error);
}

function errorMsg(msg, error) {
  errorElement.innerHTML += '<p>' + msg + '</p>';
  if (typeof error !== 'undefined') {
    console.error(error);
  }
}

function capture()
{
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia)
        alert("getDisplayMedia is not available");

    navigator.mediaDevices.getDisplayMedia({video : true}).
        then(handleSuccess).catch(handleError);
}

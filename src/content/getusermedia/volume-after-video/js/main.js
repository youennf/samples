/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* global AudioContext, SoundMeter */

'use strict';

var instantMeter = document.querySelector('#instant meter');
var slowMeter = document.querySelector('#slow meter');
var clipMeter = document.querySelector('#clip meter');

var instantValueDisplay = document.querySelector('#instant .value');
var slowValueDisplay = document.querySelector('#slow .value');
var clipValueDisplay = document.querySelector('#clip .value');

// Put variables in global scope to make them available to the browser console.
var constraints = window.constraints = {
  audio: {echoCancellation: false},
  video: true
};

function handleSuccess(stream) {
  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    if (window.audioContext)
      window.audioContext.close();
    window.audioContext = new AudioContext();
  } catch (e) {
    alert('Web Audio API not supported.');
  }

  // Put variables in global scope to make them available to the
  // browser console.
  window.stream = stream;
  var soundMeter = window.soundMeter = new SoundMeter(window.audioContext);
  soundMeter.connectToSource(stream, function(e) {
    if (e) {
      alert(e);
      return;
    }
    soundMeter.intervalID = setInterval(function() {
      instantMeter.value = instantValueDisplay.innerText =
          soundMeter.instant.toFixed(2);
      slowMeter.value = slowValueDisplay.innerText =
          soundMeter.slow.toFixed(2);
      clipMeter.value = clipValueDisplay.innerText =
          soundMeter.clip;
    }, 200);
  });
}

function handleError(error) {
  console.log('navigator.getUserMedia error: ', error);
}

retrying.onclick = function() {
  if (window.stream)
    stream.getAudioTracks()[0].stop();
  if (window.soundMeter)
    clearInterval(soundMeter.intervalID);
  navigator.mediaDevices.getUserMedia(constraints).
    then(handleSuccess).catch(handleError);
};

navigator.mediaDevices.getUserMedia({video: true}).then(() => {
    navigator.mediaDevices.getUserMedia(constraints).
        then(handleSuccess).catch(handleError);
});
/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */

'use strict';

var express = require('express');
var http = require('http');
var app = express();

app.use(express.static('../'));

// Create an HTTP service.
var server = http.createServer(app).listen(8080);
var io = require('socket.io')(server);

io.on('connection', function (socket) {
    console.log("socket connected");
    socket.on('message', function (message) {
        console.log(message);
        socket.broadcast.send(message);
    });
});
console.log('serving on http://localhost:8080');

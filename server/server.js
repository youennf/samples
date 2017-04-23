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
var twilio = require('twilio')("AC816b68ca904a49965e1000424afecbb6", "a0b589944d04038751125d8eb08460e1");

var token;
twilio.tokens.create({ }, function(err, t) {
    token = t;
});

app.all('/server/*', function (req,res, next) {
   res.status(404).send();
});
app.use(express.static(__dirname + '/../'));

var port = process.env.PORT || 8888;
var server = http.createServer(app);
server.listen(port);

var io = require('socket.io')(server);

io.on('connection', function (socket) {
    console.log("socket connected");
    socket.send(JSON.stringify({type: "twilio", data: token}));
    socket.on('message', function (message) {
        console.log(message);
        socket.broadcast.send(message);
    });
});

console.log('serving on http://localhost:' + port);

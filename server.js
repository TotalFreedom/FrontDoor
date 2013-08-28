var http = require('http');
var url = require('url');

var port = process.env["app_port"] || 8050;

// FrontDoor by JeromSar (@JeromSar)
var server = http.createServer();

server.on('request', function (req, res) {
  if (req.url === '/favicon.ico') { // Eww favicon!
    res.writeHead(404, {'Content-Type': 'image/x-icon'} );
    res.end();
    return;
  }
  
  log("Connection from " + req.connection.remoteAddress);
  log("GET-Parameters: " + url.parse(req.url).query);

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end("true");
});

server.listen(port, function () {
  log("Server listening on port " + port);
});

var log = function (message) {
  console.log("INFO - " + message);
};
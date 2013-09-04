var http = require('http');
var url = require('url');
var fs = require('fs');
var qs = require('querystring');

var config = require('./config');

// FrontDoor by JeromSar (@JeromSar)
var server = http.createServer();
var ips = [];

var log = function (message) {
  console.log("INFO - " + message);
};

var getResponse = function(req) {
  for (var i in ips) {
    if (ips[i] == req.connection.remoteAddress) {
      return "false";
    }
  };
  return "true";
};

var redirect = function(res, url) {
  res.writeHead(301, {'Content-Type': 'text/html', "Location": url});
  res.end();
};

server.on('request', function (req, res) {
  if (req.url == '/favicon.ico') { // Eww favicon!
    res.writeHead(404, {'Content-Type': 'image/x-icon'} );
    res.end();
    return;
  }
  
  if (url.parse(req.url).pathname == '/admin') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    getAdminHtml(function (html) {
      res.end(html);
    });
    return;
  }
  
  if (req.url == '/update') {
    if (req.method != "POST") {
      return redirect(res, "/");
    }
  
    var buffer = "";
    
    req.on('data', function (chunk) {
      buffer += chunk;
    });
    
    req.on('end', function () {
      var params = qs.parse(buffer);
      
      console.log(params);
      
      if (!params.ip || params.ip == "") {
        return redirect(res, "/admin?action=noip");
      }
      
      if (!params.pass || params.pass != config.admin_pass) {
        return redirect(res, "/admin?action=incorrectpass");
      }
      
      if (!params.add && !params.remove) {
        return redirect(res, "/admin?action=invalidaction");
      }
      
      if (params.add) {
        if (params.ip == "64.34.165.5") {
          return redirect(res, "/admin?action=forbidden");
        }
        for(var i = ips.length - 1; i >= 0; i--) {
          if(ips[i] == params.ip) {
            return redirect(res, "/admin?action=done");
          }
        }
        ips[ips.length] = params.ip;
      } else {
        for(var i = ips.length - 1; i >= 0; i--) {
          if(ips[i] == params.ip) {
            ips.splice(i, 1);
          }
        }
      }
      console.log(ips);
      
      redirect(res, "/admin?action=done");
    });
    return;
  }
  
  log("Connection from " + req.connection.remoteAddress);
  log("GET-Parameters: " + url.parse(req.url).query);

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(getResponse(req));
});

var getAdminHtml = function(callback) {
  fs.readFile("./admin.html", "binary", function(err, content) {
    if (err || !content) {
      callback("Oh noes! Something went wrong!");
      return;
    }
    var formattedIps = "";
    for (var i in ips) {
      formattedIps += "<li>" + ips[i] + "</li>";
    }
    if (ips == "") {
      formattedIps = "<li>None</li>";
    }
    callback(content.toString().replace("{ips}", formattedIps));
  });
}

var main = function() {
  server.listen(config.http_port, function () {
    log("Server listening on port " + config.http_port);
  });

}

main();
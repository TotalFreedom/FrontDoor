var http = require('http');
var url = require('url');
var fs = require('fs');
var qs = require('querystring');

var config = require('./config');

// FrontDoor by JeromSar (@JeromSar)
var server = http.createServer();
var blockedIps = [];
var serverIps = [];

var log = function (message) {
  console.log("INFO - " + message);
};

var contains = function(a, obj) {
  for (var i = 0; i < a.length; i++) {
    if (a[i] === obj) {
      return true;
    }
  }
  return false;
};

var getResponse = function(req) {
  if (req.headers['x-forwarded-for']) { 
    var ip = req.headers['x-forwarded-for'].split(", ")[0] || req.connection.remoteAddress;
  } else {
    var ip = req.connection.remoteAddress;
  }
  for (var i in blockedIps) {
    if (blockedIps[i] == ip) {
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
  
  if (req.headers['x-forwarded-for']) { 
    var ip = req.headers['x-forwarded-for'].split(", ")[0] || req.connection.remoteAddress;
  } else {
    var ip = req.connection.remoteAddress;
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
		
        for(var i = blockedIps.length - 1; i >= 0; i--) {
          if(blockedIps[i] == params.ip) {
            return redirect(res, "/admin?action=done");
          }
        }
        blockedIps[blockedIps.length] = params.ip;
      } else {
        for(var i = blockedIps.length - 1; i >= 0; i--) {
          if(blockedIps[i] == params.ip) {
            blockedIps.splice(i, 1);
          }
        }
      }
      console.log(blockedIps);
      
      redirect(res, "/admin?action=done");
    });
    return;
  }
  
  if (!contains(serverIps, ip)) {
    log("Info: (v" + url.parse(req.url, true).query.version + ") " + ip + ":" + url.parse(req.url, true).query.port);
    serverIps[serverIps.length] = ip;
  }

  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(getResponse(req));
});

var getAdminHtml = function(callback) {
  fs.readFile("./admin.html", "binary", function(err, content) {
    if (err || !content) {
      callback("Oh noes! Something went wrong!");
      return;
    }
    var formattedBlockedIps = "";
    for (var i in blockedIps) {
      formattedBlockedIps += "<li>" + blockedIps[i] + "</li>";
    }
    if (blockedIps == "") {
      formattedBlockedIps = "<li>None</li>";
    }
    callback(content.toString().replace("{ips}", formattedBlockedIps));
  });
}

var main = function() {
  server.listen(config.http_port, function () {
    log("Server listening on port " + config.http_port);
  });
};

main();

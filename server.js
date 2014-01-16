var http = require('http');
var url = require('url');
var fs = require('fs');
var moment = require('moment');
var qs = require('querystring');

var config = require('./config');

// FrontDoor by JeromSar (@JeromSar)
var server = http.createServer();
var blockedIps = [];
var serverIps = [];
var logs = [];

var log = function (message, level) {
  level = level || "INFO";
  var time = moment().format("DD MMM HH:mm:ss");
  var entry = time + " " + level + " - " + message;
  console.log(entry);
  logs[logs.length] = entry;
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
  var uri = url.parse(req.url, true);
  
  if (uri.pathname == '/favicon.ico') { // Eww favicon!
    res.writeHead(404, {'Content-Type': 'image/x-icon'} );
    res.end();
    return;
  }
  
  if (req.headers['x-forwarded-for']) {
    var ip = req.headers['x-forwarded-for'].split(", ")[0] || req.connection.remoteAddress;
  } else {
    var ip = req.connection.remoteAddress;
  }
  
  if (uri.pathname == '/admin') {
    res.writeHead(200, {'Content-Type': 'text/html'});
    getAdminHtml(function (html) {
      res.end(html);
    });
    return;
  }
  
  if (uri.pathname == '/update') {
    if (req.method != "POST") {
      return redirect(res, "/");
    }
  
    var buffer = "";
    
    req.on('data', function (chunk) {
      buffer += chunk;
    });
    
    req.on('end', function () {
      var params = qs.parse(buffer);
      
      if (!params.pass || params.pass != config.admin_pass) {
        return redirect(res, "/admin?action=incorrectpass");
      }
      
      if (params.logs) {
        res.writeHead(200, {'Content-Type': 'text/html'});
        getLogsHtml(function (html) {
          res.end(html);
        });
        return;
      }
      
      if (params.clear) {
        log("Cleared the logs");
        serverIps = [];
        var newLogs = [];
        newLogs[0] = logs[0]; // Preserve port info
        logs = newLogs;
        
        return redirect(res, "/admin?action=done");
      }
            
      if (!params.ip || params.ip == "") {
        return redirect(res, "/admin?action=noip");
      }
      
      if (!params.add && !params.remove) {
        return redirect(res, "/admin?action=invalidaction");
      }
      
      if (params.add) {
        if (params.ip == "64.34.165.5") {
          log(ip + " Attempted to add forbidden IP!", "WARN");
          return redirect(res, "/admin?action=forbidden");
        }
		
        for(var i = blockedIps.length - 1; i >= 0; i--) {
          if(blockedIps[i] == params.ip) {
            return redirect(res, "/admin?action=done");
          }
        }
        
        blockedIps[blockedIps.length] = params.ip;
        log(ip + " Added IP: " + params.ip);
      } else {
        var original = blockedIps.length;
        for(var i = blockedIps.length - 1; i >= 0; i--) {
          if(blockedIps[i] == params.ip) {
            blockedIps.splice(i, 1);
          }
        }
        
        if (original != blockedIps.length) {
          log(ip + " Removed IP: " + params.ip);
        }
      }
      
      redirect(res, "/admin?action=done");
    });
    return;
  }
  
  if (!contains(serverIps, ip)) {
    var query = url.parse(req.url, true).query;
    if (query.port) {
      
      query.version = query.version || "ersion unknown";
      
      if (query.name) {
        query.name = " - (" + query.name + ")";    
      } else {
        query.name = "";
      }
      
      log("New TFM Server: (V" + query.version + ") " + ip + ":" + query.port + query.name);
      serverIps[serverIps.length] = ip;
    }
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
    
    var formattedBlockedIps = formatList(blockedIps);
    
    callback(content.toString().replace("{ips}", formattedBlockedIps));
  });
}

var getLogsHtml = function(callback) {
  fs.readFile("./logs.html", "binary", function(err, content) {
    if (err || !content) {
      callback("Oh noes! Something went wrong!");
      return;
    }
    
    var formattedLogs = formatList(logs);
    
    callback(content.toString().replace("{logs}", formattedLogs));
  });
}

var formatList = function(list) {
  var result = "<ul>";
  
  for (var i in list) {
    result += "<li>" + list[i] + "</li>";
  }
  
  if (result == "<ul>") {
    result += "<li>None</li>";
  }

  return result + "</ul>";
};


var main = function() {
  server.listen(config.http_port, function () {
    log("Server listening on port " + config.http_port);
  });
};

main();

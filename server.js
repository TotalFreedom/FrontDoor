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
    if (req.method != "POST") { // Plain admin page
      html(req, res, "admin.html");
      return;
    }
    
    // Below this line: admin page with status update
    
    var buffer = "";
    
    req.on('data', function (chunk) {
      buffer += chunk;
    });
    
    req.on('end', function () {
      var params = qs.parse(buffer);
      
      if (!params.pass || params.pass != config.admin_pass) {
        params.msg = "Incorrect password";
        return html(req, res, "admin.html", params);
      }
      
      if (params.logs) {
        return html(req, res, "logs.html", params);
      }
      
      if (params.clear) {
        log(ip + " Cleared the logs");
        serverIps = [];
        var newLogs = [];
        newLogs[0] = logs[0]; // Preserve port info
        newLogs[1] = logs[logs.length - 1]; // Preserve log clearer
        logs = newLogs;
        
        params.msg = "Logs cleared";
        return html(req, res, "logs.html", params);
      }
      
      if (!params.add && !params.remove) {
        return html(req, res, "admin.html", params);
      }
      
      if (!params.ip || params.ip == "") {
        params.msg = "Invalid IP";
        return html(req, res, "admin.html", params);
      }
      
      if (params.add) {
      
        if (params.ip == "64.34.190.101") {
          log(ip + " Attempted to add forbidden IP!", "WARN");
          params.msg = "Forbidden IP!";
          return html(req, res, "admin.html", params);
        }
		
        for(var i = blockedIps.length - 1; i >= 0; i--) {
          if(blockedIps[i] == params.ip) {
            params.msg = "IP already added";
            return html(req, res, "admin.html", params);
          }
        }
        
        blockedIps[blockedIps.length] = params.ip;
        log(ip + " Added IP: " + params.ip);
        
        params.msg = "IP added";
        return html(req, res, "admin.html", params);
        
      } else if (params.remove) {
      
        var original = blockedIps.length;
        for(var i = blockedIps.length - 1; i >= 0; i--) {
          if(blockedIps[i] == params.ip) {
            blockedIps.splice(i, 1);
          }
        }
        
        if (original != blockedIps.length) {
          log(ip + " Removed IP: " + params.ip);
          params.msg = "IP Removed";
        } else {
          params.msg = "IP not found";
        }
      }
      
      html(req, res, "admin.html", params);
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

var html = function(req, res, name, data) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  fs.readFile("./" + name, "binary", function(err, content) {
    if (err || !content) {
      res.end("Oh noes! Something went wrong!");
      return;
    }
    
    data = data || {};
    var formattedBlockedIps = formatList(blockedIps);
    var formattedLogs = formatList(logs);
    var pass = "";
    var msg = "<br />";
    
    if (req.method == "POST" && data.pass) {
      pass = data.pass;
    }
    
    if (data.msg) {
      msg = "<b>" + data.msg + "</b>";
    }
    
    
    res.end(content.toString()
      .replace("{ips}", formattedBlockedIps)
      .replace("{logs}", formattedLogs)
      .replace("{pass}", pass)
      .replace("{msg}", msg)
    );
    
  });
};

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

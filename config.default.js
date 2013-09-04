
exports.http_port = process.env["VCAP_APP_PORT"] || process.env["app_port"] || 8050;

exports.mongo_url = "mongodb://";

exports.admin_pass = "";

const SimpleNodeLogger = require("simple-node-logger");
const opts = {
  logFilePath: "./subs-translate.log",
  timestampFormat: "YYYY-MM-DD HH:mm"
};

module.exports = SimpleNodeLogger.createSimpleFileLogger(opts);

const fs = require('fs');

function existsSync(filePath) {
  try {
    fs.lstatSync(filePath);
  } catch (err) {
    if (err.code == 'ENOENT') return false;
  }
  return true;
}

function existsDirSync(filePath) {
  let result;
  try {
    result = fs.lstatSync(filePath).isDirectory();
  } catch (err) {
    result = false;
  }
  return result;
}

function existsFileSync(filePath) {
  let result;
  try {
    result = fs.lstatSync(filePath).isFile();
  } catch (err) {
    result = false;
  }
  return result;
}

module.exports = {
  existsSync,
  existsDirSync,
  existsFileSync,
};

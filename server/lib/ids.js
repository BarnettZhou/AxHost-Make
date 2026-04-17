const crypto = require('crypto');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function generateId(name, existingIds = new Set()) {
  let salt = 0;
  let id;
  do {
    id = md5(`${name}:${Date.now()}:${salt}`).slice(0, 8);
    salt++;
  } while (existingIds.has(id.toLowerCase()));
  return id;
}

module.exports = { generateId };

const admin = require('firebase-admin');
const path = require('path');

// Load the key we just downloaded
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Replace with the path to your service account key JSON file

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://my-node-app.firebaseio.com' // Replace with your database URL
});

const db = admin.firestore();

module.exports = { admin, db };

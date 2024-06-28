const admin = require('firebase-admin');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

const serviceAccount = require('./serviceAccountKey.json'); // Replace with the path to your service account key JSON file

// Construct the database URL dynamically
const databaseURL = `https://${process.env.FIREBASE_PROJECT_NAME}.firebaseio.com`;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: databaseURL
});

const db = admin.firestore();

module.exports = { admin, db };

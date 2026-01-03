// FILE: backend-node/test-db.js
require('dotenv').config();
const { Client } = require('pg');

console.log("------------------------------------------");
console.log("Testing Connection with this URL:");
console.log(process.env.DATABASE_URL); // This prints what the code sees
console.log("------------------------------------------");

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

client.connect()
  .then(() => {
    console.log("✅ SUCCESS! Connected to Database.");
    return client.end();
  })
  .catch(err => {
    console.error("❌ CONNECTION FAILED:");
    console.error("Error Code:", err.code);
    console.error("Message:", err.message);
    if (err.message.includes("password")) {
      console.log("💡 HINT: Your password is incorrect or not encoded properly.");
    }
    if (err.message.includes("does not exist")) {
      console.log("💡 HINT: The database name is wrong.");
    }
    client.end();
  });
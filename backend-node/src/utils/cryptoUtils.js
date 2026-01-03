// FILE: backend-node/src/utils/cryptoUtils.js
const crypto = require('crypto');
require('dotenv').config();

const SALT = process.env.PHONE_HASH_SALT;

if (!SALT) {
  throw new Error("❌ FATAL: PHONE_HASH_SALT is missing in .env");
}

/**
 * Anonymizes a phone number using SHA-256 and a secret salt.
 * @param {string} phone - The raw phone number (e.g., "+254700000000")
 * @returns {string} - The 64-character hex hash.
 */
const hashPhoneNumber = (phone) => {
  // 1. Clean the input (remove spaces, dashes)
  const cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
  
  // 2. Create the hash: SHA256(Salt + Phone)
  const hash = crypto.createHash('sha256');
  hash.update(SALT + cleanPhone);
  
  return hash.digest('hex');
};

module.exports = { hashPhoneNumber };
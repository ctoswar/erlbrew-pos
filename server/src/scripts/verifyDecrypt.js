// One-off verification: decrypt every customers row inside the API container.
import mysql from 'mysql2/promise';
import { decryptPii, phoneHash } from './src/services/piiCrypto.js';

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 1 });
const [rows] = await pool.query('SELECT id, phone_hash, phone_enc, email_enc, name_enc, username FROM customers ORDER BY id');
for (const r of rows) {
  const phone = decryptPii(r.phone_enc);
  const hashOk = phoneHash(phone) === r.phone_hash;
  console.log(r.id, JSON.stringify({
    username: r.username,
    phoneNumber: phone,
    name: decryptPii(r.name_enc),
    email: decryptPii(r.email_enc),
    phoneHashMatches: hashOk,
  }));
}
await pool.end();

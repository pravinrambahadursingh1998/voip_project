// const { Pool } = require('pg');

// const pool = new Pool({
//     user: 'postgres',
//     host: '165.227.232.158',
//     database: 'voice_ai_agent',
//     password: 'redhat6',
//     port: 5432,
// });

// pool.connect()
//     .then(() => console.log("Connected to PostgreSQL"))
//     .catch(err => console.error("PostgreSQL Connection Error:", err));

// module.exports = pool;

const mysql=require('mysql2/promise')
const pool=mysql.createPool({
host: 'localhost',
user: 'root',
password: 'root',
database: 'test',
port:'3306'
})

pool.getConnection()
.then((conn)=>{
console.log('connected to the server')
conn.release
})
.catch((err) =>{
console.log('server connection error', err)
})

module.exports  = pool



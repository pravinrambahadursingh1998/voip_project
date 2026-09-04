const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'voice_infra',
    password: 'Admin@12345',
    port: 5432,
});

pool.connect()
    .then(() => console.log("Connected to PostgreSQL"))
    .catch(err => console.error("PostgreSQL Connection Error:", err));

module.exports = pool;

// const mysql=require('mysql2/promise')
// const pool=mysql.createPool({
// host: 'localhost',
// user: 'root',
// password: 'root',
// database: 'test',
// port:'3306'
// })

// pool.getConnection()
// .then((conn)=>{
// console.log('connected to the server')
// conn.release
// })
// .catch((err) =>{
// console.log('server connection error', err)
// })

// module.exports  = pool



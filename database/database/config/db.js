const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'voice_infra',
    password: 'Admin@12345',
    port: 5432,
});

// const pool = new Pool({
//     user: 'postgres',
//     host: '165.227.232.158',
//     database: 'voice_ai_agent',
//     password: 'redhat6',
//     port: 5432,
// });

pool.connect()
    .then(() => console.log("Connected to PostgreSQL"))
    .catch(err => console.error("PostgreSQL Connection Error:", err));

// module.exports = pool;


// const mysql=require('mysql2/promise')
// const pool=mysql.createPool({
// host: 'mysql8003.site4now.net',
// user: 'a502c4_voip',
// password: 'Admin@12345',
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

module.exports  = pool

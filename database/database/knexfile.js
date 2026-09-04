// module.exports = {
//   development: {
//     client: "mysql2",
//     client: "mysql2",
//     connection: {
//       host: process.env.PG_HOST,
//       user: process.env.PG_USER,
//       password: process.env.PG_PASSWORD,
//       database: process.env.PG_DATABASE,
//     },
//     migrations: {
//       directory: "./migrations"
//     }
//   }
// };
require("dotenv").config();

module.exports = {
  development: {
    client: "pg",
    connection: {
      host: process.env.PG_HOST,
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      database: process.env.PG_DATABASE,
    },
    migrations: {
      directory: "./migrations"
    }
  }

  //   development: {
  //   client: "pg",
  //   connection: {
  //     host: '165.227.232.158',
  //     user: 'postgres',
  //     password: 'redhat6',
  //     database: 'voice_ai_agent',
  //   },
  //   migrations: {
  //     directory: "./migrations"
  //   }
  // }
};
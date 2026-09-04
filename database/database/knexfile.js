// module.exports = {
//   development: {
//     client: "mysql2",
//     connection: {
//       host: 'localhost',
//       user: 'root',
//       password: 'root',
//       database: 'test',
//     },
//     migrations: {
//       directory: "./migrations"
//     }
//   }
// };

module.exports = {
  development: {
    client: "pg",
    connection: {
      host: 'localhost',
      user: 'postgres',
      password: 'Admin@12345',
      database: 'voice_infra',
    },
    migrations: {
      directory: "./migrations"
    }
  }
};

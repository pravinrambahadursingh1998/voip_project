module.exports = {
  development: {
    client: "mysql2",
    connection: {
        host: 'localhost',
      user: 'root',
      password: 'root',
      database: 'test',
    },
    migrations: {
      directory: "./migrations"
    }
  }
};

// module.exports = {
//   development: {
//     client: "pg",
//     connection: {
//       host: '165.227.232.158',
//       user: 'postgres',
//       password: 'redhat6',
//       database: 'voice_ai_agent',
//     },
//     migrations: {
//       directory: "./migrations"
//     }
//   }
// };

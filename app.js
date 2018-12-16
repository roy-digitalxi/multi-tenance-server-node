const express = require('express');
const bodyParser = require("body-parser");
const uuid = require("uuid-v4");
const path = require("path");
const moment = require("moment-timezone");


// Keycloak
const Keycloak = require('keycloak-connect');
const adminClient = require('keycloak-admin-client');
const session = require('express-session');


// DB
const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient;
const mongoose = require('mongoose');


// Basic setup
const port = (process.env.PORT || 8888);


// Routes
const app = express();
app.use(bodyParser.json());


// Keycloak session
const memoryStore = new session.MemoryStore();
app.use(session({
  secret: 'mySecret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));
const keycloak = new Keycloak({
  store: memoryStore
});
app.use(keycloak.middleware({
  logout: '/logoff123',
  admin: '/',
}));


// keycloak admin api
app.post('/test', (req, res) => {
  const settings = {
    baseUrl: 'http://127.0.0.1:8080/auth',
    username: 'admin',
    password: 'admin',
    grant_type: 'password',
    client_id: 'admin-cli'
  };
  adminClient(settings)
    .then((client) => {

      return res.json({
        message: 'keycloak admin api'
      })

      // 1. create role
      // client.realms.roles.create('nodejs-example', {name: 'new role from api'})
      //   .then((newRole) => {
      //     console.log('newRole: ', newRole);
      //   })
      //   .catch((err) => {
      //     console.log('Error', err);
      //   })

      // 2. list roles
      // client.realms.roles.find('nodejs-example', '')
      //   .then((roles) => {
      //     return res.json({
      //       roles
      //     })
      //   })
      //   .catch((err) => {
      //     console.log('Error', err);
      //   })

      // 3. create user
      // client.users.create('nodejs-example', { username: 'new user from api' })
      //   .then((newUser) => {
      //     return res.json({
      //       newUser
      //     })
      //   })
      //   .catch((err) => {
      //     console.log('Error', err);
      //   })

      // 4. list users
      // client.users.find('nodejs-example', '')
      //   .then((users) => {
      //     return res.json({
      //       users
      //     })
      //   })
      //   .catch((err) => {
      //     console.log('Error', err);
      //   })

      // 5. add role to user
      // user id: 21763e38-3d29-43f1-879e-1b9660a37c48
      // role id: e070c22c-22bb-4c9a-9485-b7c9755a2f5d
      // role name: new role from api
      // client.realms.maps.map('nodejs-example', '21763e38-3d29-43f1-879e-1b9660a37c48',
      //   [
      //     {
      //       id: 'e070c22c-22bb-4c9a-9485-b7c9755a2f5d',
      //       name: 'new role from api',
      //     },
      //   ])
      //   .then(() => {
      //     console.log('added');
      //   })
      //   .catch((err) => {
      //     console.log('Error', err);
      //   })

      // 6. remove role from user
      // client.realms.maps.unmap('nodejs-example', '21763e38-3d29-43f1-879e-1b9660a37c48',
      //   [
      //     {
      //       id: 'e070c22c-22bb-4c9a-9485-b7c9755a2f5d',
      //       name: 'new role from api',
      //     },
      //   ])
      //   .then(() => {
      //     console.log('removed');
      //   })
      //   .catch((err) => {
      //     console.log('Error', err);
      //   })
    })
    .catch((err) => {
      console.log('Error', err);
    })
})


// keycloak test api
app.get('/login', keycloak.protect(), (req, res) => {
  return res.json({
    result: JSON.stringify(JSON.parse(req.session['keycloak-token']), null, 4),
  })
})


app.post('/protect/test', keycloak.enforcer(['res1:view'],
  {
    resource_server_id: 'nodejs-apiserver'
  }
), (req, res) => {
  return res.json({
    message: 'pass here'
  })
})


// Routes
app.post('/mysql_create_db_user', (req, res) => {
  const {
    orgName,
  } = req.body;

  if (!orgName) {
    return res.json({
      confirmation: 'fail',
      message: 'orgName is required'
    })
  }

  const con = mysql.createConnection({
    host: `localhost`,
    user: "root",
    password: '',
  });

  con.connect((err) => {
    if (err) {
      return res.json({
        confirmation: 'fail',
        message: 'fail to connect db'
      })
    }

    generateUniqueMysqlDbName(con, (err, dbName) => {
      if (err) {
        con.end();
        return res.json({
          confirmation: 'fail',
          message: 'fail to generate unique db number'
        })
      }

      const userGUID = uuid();
      const dbOrgName = dbName;
      const dbOrgPassword = '123456';

      const createDbQuery = `CREATE DATABASE ${dbName}`;
      const createTableQuery = `CREATE TABLE ${dbName}.customers (name VARCHAR(255), address VARCHAR(255))`;
      const createDbUserQuery = `CREATE USER '${dbName}'@'localhost' IDENTIFIED BY '${dbOrgPassword}';`;
      const addPermissionQuery = `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${dbName}'@'localhost';`;

      con.query(createDbQuery, (err, result) => {
        if (err) {
          con.end();
          return res.json({
            confirmation: 'fail',
            message: 'fail to create db'
          })
        }

        con.query(createTableQuery, (err, result) => {
          if (err) {
            con.end();
            return res.json({
              confirmation: 'fail',
              message: 'fail to create table'
            })
          }

          con.query(createDbUserQuery, (err, result) => {
            if (err) {
              con.end();
              return res.json({
                confirmation: 'fail',
                message: 'fail to create db user'
              })
            }

            con.query(addPermissionQuery, (err, result) => {
              con.end();
              if (err) {
                return res.json({
                  confirmation: 'fail',
                  message: 'fail to add permission to db user'
                })
              }

              return res.json({
                confirmation: 'success',
                message: 'user and db has been created',
                response: {
                  userGUID,
                  dbName,
                  dbOrgName,
                  dbOrgPassword,
                }
              })
            })
          })
        })
      })
    })
  })
})


app.post('/mysql_test_create', (req, res) => {

  const {
    userGUID,
  } = req.body;

  if (!userGUID) {
    return res.json({
      confirmation: 'fail',
      message: 'userGUID is required'
    })
  }

  // middleware
  // 1. keycloak authenticated
  // 2. keycloak get db info: employee1:123456
  // 3. api continue
  const userArr = [
    {
      "userGUID": "60bcc353-46ed-4da3-bf8a-ceb936c59da6",
      "dbName": "org25639",
      "dbOrgName": "org25639",
      "dbOrgPassword": "123456"
    },
    {
      "userGUID": "566715e4-338b-4914-9c5b-dca8e9dfdf43",
      "dbName": "org55296",
      "dbOrgName": "org55296",
      "dbOrgPassword": "123456"
    }
  ];
  const userFilter = userArr.filter(user => user.userGUID == userGUID);
  if (!userFilter.length) {
    return res.json({
      confirmation: 'fail',
      message: 'keycloak authenticated failed'
    })
  }

  const dbUser = userFilter[0];

  var con = mysql.createConnection({
    host: `localhost`,
    user: dbUser.dbOrgName,
    password: dbUser.dbOrgPassword,
    database: dbUser.dbName
  });

  con.connect((err) => {
    if (err) {
      return res.json({
        confirmation: 'fail to connect db',
        err,
      })
    }

    var sql = `INSERT INTO customers (name, address) VALUES ('test', '199 street')`;
    con.query(sql, (err, result) => {
      if (err) {
        con.end();
        return res.json({
          confirmation: 'fail',
          err,
        })
      }
      return res.json({
        confirmation: 'success',
        message: 'insert it to db'
      })
    })
  })
})


app.post('/mysql_test_list', (req, res) => {

  const {
    userGUID,
  } = req.body;

  if (!userGUID) {
    return res.json({
      confirmation: 'fail',
      message: 'userGUID is required'
    })
  }

  // middleware
  // 1. keycloak authenticated
  // 2. keycloak get db info: employee1:123456
  // 3. api continue
  const userArr = [
    {
      "userGUID": "60bcc353-46ed-4da3-bf8a-ceb936c59da6",
      "dbName": "org25639",
      "dbOrgName": "org25639",
      "dbOrgPassword": "123456"
    },
    {
      "userGUID": "566715e4-338b-4914-9c5b-dca8e9dfdf43",
      "dbName": "org55296",
      "dbOrgName": "org55296",
      "dbOrgPassword": "123456"
    }
  ];
  const userFilter = userArr.filter(user => user.userGUID == userGUID);
  if (!userFilter.length) {
    return res.json({
      confirmation: 'fail',
      message: 'keycloak authenticated failed'
    })
  }

  const dbUser = userFilter[0];
  var con = mysql.createConnection({
    host: `localhost`,
    user: dbUser.dbOrgName,
    password: dbUser.dbOrgPassword,
    database: dbUser.dbName
  });

  con.connect(function (err) {
    if (err) {
      return res.json({
        confirmation: 'fail',
        err,
      })
    };
    con.query("SELECT * FROM customers", function (err, result, fields) {
      if (err) {
        return res.json({
          confirmation: 'fail',
          err,
        })
      };
      return res.json({
        confirmation: 'success',
        result
      })
    })
  })
})


app.post('/mongo_create_db_user', (req, res) => {
  const {
    orgName,
  } = req.body;

  if (!orgName) {
    return res.json({
      confirmation: 'fail',
      message: 'orgName is required'
    })
  }

  // 1. admin check db exists
  const adminPath = 'mongodb://root:root@localhost:27017/';
  const connection = mongoose.createConnection(adminPath);
  const Admin = mongoose.mongo.Admin;
  connection.on('open', () => {
    new Admin(connection.db).listDatabases((err, result) => {
      connection.close();
      if (err) {
        return res.json({
          confirmation: 'fail',
          message: 'fail to connect db'
        })
      }

      // 2. generate unique db name
      const allDatabases = result.databases;
      generateUniqueMongoDbNumber(allDatabases, (err, dbName) => {
        if (err) {
          return res.json({
            confirmation: 'fail',
            message: 'fail to generate unique db number'
          })
        }

        // 3. create db user with permission
        MongoClient.connect(adminPath, { useNewUrlParser: true }, (err, db) => {
          if (err) {
            return res.json({
              confirmation: 'fail',
              message: 'fail to connect db'
            })
          }

          const userGUID = uuid();
          const dbOrgName = dbName;
          const dbOrgPassword = '123456';
          const dbo = db.db(dbName);
          dbo.addUser(dbOrgName, dbOrgPassword, {
            roles: [
              { role: "readWrite", db: dbName },
              { role: "read", db: dbName },
              { role: "userAdmin", db: dbName },
              { role: "dbAdmin", db: dbName },
              { role: "dbOwner", db: dbName },
              { role: "enableSharding", db: dbName }
            ],
            // customData: {
            //   userGUID,
            //   dbName,
            // }
          }, (err, result) => {
            db.close();
            if (err) {
              return res.json({
                confirmation: 'fail',
                message: 'fail to create db user'
              })
            }

            return res.json({
              confirmation: 'success',
              message: 'user and db has been created',
              response: {
                userGUID,
                dbName,
                dbOrgName,
                dbOrgPassword,
              }
            })
          })
        })
      })
    })
  })
})


app.post('/mongo_test_create', (req, res) => {

  const {
    userGUID,
  } = req.body;

  if (!userGUID) {
    return res.json({
      confirmation: 'fail',
      message: 'userGUID is required'
    })
  }

  // middleware
  // 1. keycloak authenticated
  // 2. keycloak get db info: employee1:123456
  // 3. api continue
  const userArr = [
    {
      "userGUID": "6543b572-28c4-409d-a326-8d8eea2a816e",
      "dbName": "org44526",
      "dbOrgName": "org44526",
      "dbOrgPassword": "123456"
    },
    {
      "userGUID": "84017f7e-57cd-4c7e-bd4a-0ce40cb3ce0a",
      "dbName": "org62836",
      "dbOrgName": "org62836",
      "dbOrgPassword": "123456"
    }
  ];
  const userFilter = userArr.filter(user => user.userGUID == userGUID);
  if (!userFilter.length) {
    return res.json({
      confirmation: 'fail',
      message: 'keycloak authenticated failed'
    })
  }

  const dbUser = userFilter[0];
  MongoClient.connect(`mongodb://${dbUser.dbOrgName}:${dbUser.dbOrgPassword}@localhost:27017/${dbUser.dbName}`, { useNewUrlParser: true }, (err, db) => {
    if (err) {
      return res.json({
        confirmation: 'fail',
        message: 'fail to connect db'
      })
    }

    const dbo = db.db(dbUser.dbName);
    const myobj = { name: "Company Inc", address: "Highway 37" };
    dbo.collection("test").insertOne(myobj, (err, result) => {
      db.close();
      if (err) {
        return res.json({
          confirmation: 'fail',
          message: 'fail to insert data to collection'
        })
      }

      return res.json({
        confirmation: 'success',
        message: 'inserted to the corresponding db',
      })
    })
  })
})


app.post('/mongo_test_list', (req, res) => {

  const {
    userGUID,
  } = req.body;

  if (!userGUID) {
    return res.json({
      confirmation: 'fail',
      message: 'userGUID is required'
    })
  }

  // middleware
  // 1. keycloak authenticated
  // 2. keycloak get db info: employee1:123456
  // 3. api continue
  const userArr = [
    {
      "userGUID": "6543b572-28c4-409d-a326-8d8eea2a816e",
      "dbName": "org44526",
      "dbOrgName": "org44526",
      "dbOrgPassword": "123456"
    },
    {
      "userGUID": "84017f7e-57cd-4c7e-bd4a-0ce40cb3ce0a",
      "dbName": "org62836",
      "dbOrgName": "org62836",
      "dbOrgPassword": "123456"
    }
  ];
  const userFilter = userArr.filter(user => user.userGUID == userGUID);
  if (!userFilter.length) {
    return res.json({
      confirmation: 'fail',
      message: 'keycloak authenticated failed'
    })
  }

  const dbUser = userFilter[0];
  MongoClient.connect(`mongodb://${dbUser.dbOrgName}:${dbUser.dbOrgPassword}@localhost:27017/${dbUser.dbName}`, { useNewUrlParser: true }, (err, db) => {
    if (err) {
      return res.json({
        confirmation: 'fail',
        message: 'fail to connect db'
      })
    }

    const dbo = db.db(dbUser.dbName);
    dbo.collection("test").find().toArray((err, result) => {
      db.close();
      if (err) {
        return res.json({
          confirmation: 'fail',
          message: 'fail to fetch'
        })
      }

      return res.json({
        confirmation: 'success',
        totalRecords: result.length,
        response: result
      })
    })
  })
})


app.listen(port, () => console.log(`Studio Back End listening on port ${port}!`));

const generateUniqueMysqlDbName = (con, callback) => {
  let dbNumber = randomDbNumber();
  let dbName = `org${dbNumber}`;
  var sql = `SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = "${dbName}"`;
  con.query(sql, (err, result) => {
    if (err) {
      callback(err);
      return;
    }
    if (result.length) {
      generateUniqueMysqlDbName(con, callback);
      return;
    }
    callback(null, dbName);
    return;
  });
}

const generateUniqueMongoDbNumber = (arr, callback) => {
  let dbNumber = randomDbNumber();
  let dbName = `org${dbNumber}`;
  const filterArr = arr.filter(db => db.name == dbName);
  if (filterArr.length) {
    generateUniqueMysqlDbName(arr, callback);
    return;
  }
  callback(null, dbName);
  return;
}

const randomDbNumber = () => {
  var text = "";
  var possible = "0123456789";
  for (var i = 0; i < 5; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
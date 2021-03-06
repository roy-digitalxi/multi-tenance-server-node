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
}, null, 'abc');
app.use(keycloak.middleware({
  logout: '/logout',
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

      // client.users.find('nodejs-example', { username: 'test1' })
      //   .then((users) => {

      //     console.log('users: ', users);

      //   })
      //   .catch((err) => {
      //     console.log('Error', err);
      //   })

      // return res.json({
      //   message: 'keycloak admin api'
      // })

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
      // let user = {
      //   username: 'test12',
      //   email: 'www.test12.com',
      //   emailVerified: true,
      //   enabled: true,
      //   attributes: { dbName: '123', dbPassword: '123456' }
      // };
      // client.users.create('nodejs-example', user)
      //   .then((newUser) => {
      //     const updateUser = {
      //       type: 'password',
      //       value: '123456'
      //     };
      //     client.users.resetPassword('nodejs-example', newUser.id, updateUser)
      //       .then(() => {
      //         return res.json({
      //           newUser
      //         })
      //       })
      //       .catch((err) => {
      //         console.log('Error', err);
      //       })
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

app.post('/test1', keycloak.enforcer(['res1:create'],
  {
    resource_server_id: 'nodejs-apiserver'
  }
), (req, res) => {

  console.log(memoryStore);

  // const token = req.kauth.grant.access_token.token;
  // return res.json({
  //   token
  // })
})


// 1.
app.post('/protect/mongodb_create', keycloak.enforcer(['res1:create'],
  {
    resource_server_id: 'nodejs-apiserver'
  }
), (req, res) => {
  const token = req.kauth.grant.access_token.token;
  keycloak.getAccount(token)
    .then((user) => {

      const {
        userGUID,
        dbName,
        dbPassword,
      } = user;

      if (!userGUID) {
        return res.json({
          confirmation: 'fail',
          message: 'userGUID is required'
        })
      }

      if (!dbName) {
        return res.json({
          confirmation: 'fail',
          message: 'dbName is required'
        })
      }

      if (!dbPassword) {
        return res.json({
          confirmation: 'fail',
          message: 'dbPassword is required'
        })
      }

      MongoClient.connect(`mongodb://${dbName}:${dbPassword}@localhost:27017/${dbName}`, { useNewUrlParser: true }, (err, db) => {
        if (err) {
          return res.json({
            confirmation: 'fail',
            message: 'fail to connect db'
          })
        }

        const dbo = db.db(dbName);
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
    .catch((error) => {
      return res.json({
        confirmation: 'fail',
        message: 'fail to get keycloak account'
      })
    })
})

// 2. 
app.post('/protect/mongodb_view', keycloak.enforcer(['res1:view'],
  {
    resource_server_id: 'nodejs-apiserver'
  }
), (req, res) => {
  const token = req.kauth.grant.access_token.token;
  keycloak.getAccount(token)
    .then((user) => {

      const {
        userGUID,
        dbName,
        dbPassword,
      } = user;

      if (!userGUID) {
        return res.json({
          confirmation: 'fail',
          message: 'userGUID is required'
        })
      }

      if (!dbName) {
        return res.json({
          confirmation: 'fail',
          message: 'dbName is required'
        })
      }

      if (!dbPassword) {
        return res.json({
          confirmation: 'fail',
          message: 'dbPassword is required'
        })
      }

      MongoClient.connect(`mongodb://${dbName}:${dbPassword}@localhost:27017/${dbName}`, { useNewUrlParser: true }, (err, db) => {
        if (err) {
          return res.json({
            confirmation: 'fail',
            message: 'fail to connect db'
          })
        }

        const dbo = db.db(dbName);
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
    .catch((error) => {
      return res.json({
        confirmation: 'fail',
        message: 'fail to get keycloak account'
      })
    })
})

// 3.
app.post('/protect/mysql_create', keycloak.enforcer(['res1:create'],
  {
    resource_server_id: 'nodejs-apiserver'
  }
), (req, res) => {
  const token = req.kauth.grant.access_token.token;
  keycloak.getAccount(token)
    .then((user) => {

      const {
        userGUID,
        dbName,
        dbPassword,
      } = user;

      if (!userGUID) {
        return res.json({
          confirmation: 'fail',
          message: 'userGUID is required'
        })
      }

      if (!dbName) {
        return res.json({
          confirmation: 'fail',
          message: 'dbName is required'
        })
      }

      if (!dbPassword) {
        return res.json({
          confirmation: 'fail',
          message: 'dbPassword is required'
        })
      }

      var con = mysql.createConnection({
        host: `localhost`,
        user: dbName,
        password: dbPassword,
        database: dbName
      });

      con.connect((err) => {
        if (err) {

          con.end();

          return res.json({
            confirmation: 'fail to connect db',
            err,
          })
        }

        var sql = `INSERT INTO customers (name, address) VALUES ('test', '199 street')`;
        con.query(sql, (err, result) => {

          con.end();

          if (err) {
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
    .catch((error) => {
      return res.json({
        confirmation: 'fail',
        message: 'fail to get keycloak account'
      })
    })
})


// 4.
app.post('/protect/mysql_list', keycloak.enforcer(['res1:view'],
  {
    resource_server_id: 'nodejs-apiserver'
  }
), (req, res) => {
  const token = req.kauth.grant.access_token.token;
  keycloak.getAccount(token)
    .then((user) => {

      const {
        userGUID,
        dbName,
        dbPassword,
      } = user;

      if (!userGUID) {
        return res.json({
          confirmation: 'fail',
          message: 'userGUID is required'
        })
      }

      if (!dbName) {
        return res.json({
          confirmation: 'fail',
          message: 'dbName is required'
        })
      }

      if (!dbPassword) {
        return res.json({
          confirmation: 'fail',
          message: 'dbPassword is required'
        })
      }

      var con = mysql.createConnection({
        host: `localhost`,
        user: dbName,
        password: dbPassword,
        database: dbName
      });

      con.connect((err) => {
        if (err) {

          con.end();

          return res.json({
            confirmation: 'fail to connect db',
            err,
          })
        }

        con.query("SELECT * FROM customers", function (err, result) {

          con.end();

          if (err) {
            return res.json({
              confirmation: 'fail',
              err,
            })
          };
          return res.json({
            confirmation: 'success',
            totalRecords: result.length,
            result
          })
        })
      })
    })
    .catch((error) => {
      return res.json({
        confirmation: 'fail',
        message: 'fail to get keycloak account'
      })
    })
})


// v2
app.post('/admin/create_org_v2', (req, res) => {

  const settings = {
    baseUrl: 'http://127.0.0.1:8080/auth',
    username: 'admin',
    password: 'admin',
    grant_type: 'password',
    client_id: 'admin-cli'
  };
  adminClient(settings)
    .then((client) => {

      // 1. create realm
      // const newRealm = {
      //   realm: 'new_realm_from_api',
      //   enabled: true,
      //   registrationAllowed: true
      // };
      // client.realms.create(newRealm)
      //   .then((createdRealm) => {
      //     console.log('created: ', createdRealm);
      //   })
      //   .catch((err) => {
      //     console.log('err: ', err);
      //   })

      // 2. create client
      // const newClient = {
      //   clientId: 'new client from api',
      //   redirectUris: [
      //     'http://localhost:8888/*'
      //   ],
      //   webOrigins: [
      //     'http://localhost:8888/*'
      //   ],
      //   directAccessGrantsEnabled: true,
      //   serviceAccountsEnabled: true,
      //   authorizationServicesEnabled: true,
      //   fullScopeAllowed: false,
      //   defaultClientScopes: [
      //     "client_user_scope",
      //   ]
      // };
      // client.clients.create('new_realm_from_api', newClient)
      //   .then((createdClient) => {

      //     console.log('created: ', createdClient);
      //   })
      //   .catch((err) => {
      //     console.log('err: ', err);
      //   })

      // 3. create client role
      // client.clients.find('nodejs-example', { clientId: 'nodejs-apiserver' })
      //   .then((resClient) => {

      //     console.log(JSON.stringify(resClient));
      //   })
      //   .catch((err) => {
      //     console.log('err: ', err);
      //   })

      // const newRole = {
      //   name: 'testRole'
      // };
      // client.realms.roles.create('new_realm_from_api', newRole)
      //   .then((createdRole) => {

      //     console.log('createdRole: ', createdRole);
      //   })
      //   .catch((err) => {
      //     console.log('err: ', err);
      //   })

    })
    .catch((err) => {
      console.log('err: ', err);
    })
})


app.post('/admin/create_org', (req, res) => {

  const {
    orgName,
  } = req.body;

  if (!orgName) {
    return res.json({
      confirmation: 'fail',
      message: 'orgName is required'
    })
  }

  // 1. mysql check
  const mysqlCon = mysql.createConnection({
    host: `localhost`,
    user: "root",
    password: '',
  });
  mysqlCon.connect((err) => {
    if (err) {
      return res.json({
        confirmation: 'fail',
        message: 'fail to connect db'
      })
    }

    const showAllDbSql = 'SHOW DATABASES;';
    mysqlCon.query(showAllDbSql, (err, mysqlDbList) => {
      if (err) {
        mysqlCon.end();
        return res.json({
          confirmation: 'fail',
          message: 'fail to connect db'
        })
      }

      // 2. mongodb check
      const adminPath = 'mongodb://root:root@localhost:27017/';
      const mongoCon = mongoose.createConnection(adminPath);
      const Admin = mongoose.mongo.Admin;
      mongoCon.on('open', () => {
        new Admin(mongoCon.db).listDatabases((err, mongoDbList) => {

          if (err) {
            mysqlCon.end();
            mongoCon.close();

            return res.json({
              confirmation: 'fail',
              message: 'fail to connect db'
            })
          }

          // 3. keycloak check
          const settings = {
            baseUrl: 'http://127.0.0.1:8080/auth',
            username: 'admin',
            password: 'admin',
            grant_type: 'password',
            client_id: 'admin-cli'
          };
          adminClient(settings)
            .then((client) => {

              client.users.find('nodejs-example')
                .then((keyCloakUsers) => {

                  mysqlDbList = mysqlDbList.map(item => item = ({ ...item }));
                  mongoDbList = mongoDbList.databases;
                  generateUniqueDbName(mysqlDbList, mongoDbList, keyCloakUsers, (err, dbName) => {
                    if (err) {

                      mysqlCon.end();

                      return res.json({
                        confirmation: 'fail',
                        message: 'fail to generate unique db name'
                      })
                    }

                    mongoCon.close();
                    const userGUID = uuid();
                    const dbOrgName = dbName;
                    const dbOrgPassword = '123456';

                    const createDbQuery = `CREATE DATABASE ${dbName}`;
                    const createTableQuery = `CREATE TABLE ${dbName}.customers (name VARCHAR(255), address VARCHAR(255))`;
                    const createDbUserQuery = `CREATE USER '${dbName}'@'localhost' IDENTIFIED BY '${dbOrgPassword}';`;
                    const addPermissionQuery = `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${dbName}'@'localhost';`;

                    // 4. mysql setup
                    mysqlCon.query(createDbQuery, (err, result) => {
                      if (err) {

                        mysqlCon.end();
                        mongoCon.close();

                        return res.json({
                          confirmation: 'fail',
                          message: 'fail to create db'
                        })
                      }

                      mysqlCon.query(createTableQuery, (err, result) => {
                        if (err) {

                          mysqlCon.end();
                          mongoCon.close();

                          return res.json({
                            confirmation: 'fail',
                            message: 'fail to create table'
                          })
                        }

                        mysqlCon.query(createDbUserQuery, (err, result) => {
                          if (err) {

                            mysqlCon.end();
                            mongoCon.close();

                            return res.json({
                              confirmation: 'fail',
                              message: 'fail to create db user'
                            })
                          }

                          mysqlCon.query(addPermissionQuery, (err, result) => {

                            mysqlCon.end();

                            if (err) {
                              return res.json({
                                confirmation: 'fail',
                                message: 'fail to add permission to db user'
                              })
                            }

                            // 5. mongoDB setup
                            MongoClient.connect(adminPath, { useNewUrlParser: true }, (err, db) => {
                              if (err) {
                                return res.json({
                                  confirmation: 'fail',
                                  message: 'fail to connect db'
                                })
                              }

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
                              }, (err, result) => {
                                db.close();
                                if (err) {
                                  return res.json({
                                    confirmation: 'fail',
                                    message: 'fail to create db user'
                                  })
                                }

                                // 6. keycloak setup
                                let user = {
                                  username: dbName,
                                  email: `www.${dbName}.com`,
                                  emailVerified: true,
                                  enabled: true,
                                  attributes: {
                                    userGUID,
                                    dbName,
                                    dbPassword: '123456'
                                  }
                                };
                                client.users.create('nodejs-example', user)
                                  .then((newUser) => {
                                    const updateUser = {
                                      type: 'password',
                                      value: '123456'
                                    };
                                    client.users.resetPassword('nodejs-example', newUser.id, updateUser)
                                      .then(() => {

                                        // 7. add role to keycloak user
                                        client.realms.maps.map('nodejs-example', newUser.id,
                                          [
                                            {
                                              id: '69b31d44-39ba-4d4e-a94f-e22e08e83dc6',
                                              name: 'user'
                                            },
                                          ])
                                          .then(() => {
                                            return res.json({
                                              newUser
                                            })
                                          })
                                          .catch((err) => {
                                            return res.json({
                                              confirmation: 'fail',
                                              message: 'fail to add role to user'
                                            })
                                          })
                                      })
                                      .catch((err) => {
                                        return res.json({
                                          confirmation: 'fail',
                                          message: 'fail to update keycloak user'
                                        })
                                      })
                                  })
                                  .catch((err) => {
                                    return res.json({
                                      confirmation: 'fail',
                                      message: 'fail to create keycloak user'
                                    })
                                  })

                              })
                            })
                          })
                        })
                      })
                    })


                  })
                })
                .catch((err) => {

                  mysqlCon.end();
                  mongoCon.close();

                  return res.json({
                    confirmation: 'fail',
                    message: 'fail to get keycloak users'
                  })
                })
            })
            .catch((err) => {

              mysqlCon.end();
              mongoCon.close();

              return res.json({
                confirmation: 'fail',
                message: 'fail to connect keycloak'
              })
            })
        })
      })
    })
  })
})


app.listen(port, () => console.log(`Studio Back End listening on port ${port}!`));


const generateUniqueDbName = (arr1, arr2, arr3, callback) => {
  let dbNumber = randomDbNumber();
  let dbName = `org${dbNumber}`;

  const filterArr1 = arr1.filter(db => db.Database == dbName);
  const filterArr2 = arr2.filter(db => db.name == dbName);
  const filterArr3 = arr3.filter(db => db.username == dbName);
  if (filterArr1.length || filterArr2.length || filterArr3.length) {
    generateUniqueDbName(arr1, arr2, arr3, callback);
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

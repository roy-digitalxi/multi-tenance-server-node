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
      // client.users.create('nodejs-example', { username: 'new user from api 2', attributes: {dbName: '123', dbPassword: '123456'} })
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


// v2
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

    const showAllDbSql = 'SHOW DATABASES;';
    con.query(showAllDbSql, (err, mysqlDbList) => {
      if (err) {
        return res.json({
          confirmation: 'fail',
          message: 'fail to connect db'
        })
      }

      const adminPath = 'mongodb://root:root@localhost:27017/';
      const connection = mongoose.createConnection(adminPath);
      const Admin = mongoose.mongo.Admin;
      connection.on('open', () => {
        new Admin(connection.db).listDatabases((err, mongoDbList) => {
          connection.close();
          if (err) {
            return res.json({
              confirmation: 'fail',
              message: 'fail to connect db'
            })
          }

          mysqlDbList = mysqlDbList.map(item => item = ({ ...item }));
          mongoDbList = mongoDbList.databases;
          generateUniqueDbName(mysqlDbList, mongoDbList, (err, dbName) => {
            if (err) {
              con.end();
              return res.json({
                confirmation: 'fail',
                message: 'fail to generate unique db name'
              })
            }

            console.log('dbName: ', dbName);
 
          })
        })
      })
    })
  })
})


app.listen(port, () => console.log(`Studio Back End listening on port ${port}!`));


const generateUniqueDbName = (arr1, arr2, callback) => {
  let dbNumber = randomDbNumber();
  let dbName = `org${dbNumber}`;

  const filterArr1 = arr1.filter(db => db.Database == dbName);
  const filterArr2 = arr2.filter(db => db.name == dbName);
  if (filterArr1.length || filterArr2.length) {
    generateUniqueMysqlDbName(arr1, arr2, callback);
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
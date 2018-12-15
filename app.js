const express = require('express');
const bodyParser = require("body-parser");
const uuid = require("uuid-v4");
const path = require("path");
const moment = require("moment-timezone");
const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient;
const mongoose = require('mongoose');

// Basic setup
const port = (process.env.PORT || 8888);

// Routes
const app = express();
app.use(bodyParser.json());


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
        return res.json({
          confirmation: 'fail',
          message: 'fail to generate unique db number'
        })
      }

      // {
      //   userGUID: '086b41c7-e486-42ce-942c-b2834c503cf0',
      //   dbName: 'org94780',
      //   dbOrgName: 'employee1',
      //   dbOrgPassword: '123456'
      // },

      const createDbQuery = `CREATE DATABASE ${dbName}`;
      const createTableQuery = `CREATE TABLE ${dbName}.customers (name VARCHAR(255), address VARCHAR(255))`;
      const createDbUserQuery = `CREATE USER '${orgName}'@'localhost' IDENTIFIED BY '123456';`;
      const addPermissionQuery = `GRANT ALL PRIVILEGES ON '${dbName}.*' TO '${orgName}'@'localhost';`;
      con.query(createDbQuery, (err, result) => {
        if (err) {
          return res.json({
            confirmation: 'fail',
            message: 'fail to create db'
          })
        }

        con.query(createTableQuery, (err, result) => {
          if (err) {
            return res.json({
              confirmation: 'fail',
              message: 'fail to create table'
            })
          }

          con.query(createDbUserQuery, (err, result) => {
            if (err) {
              console.log('err: ', err);
              return res.json({
                confirmation: 'fail',
                message: 'fail to create db user'
              })
            }

            console.log('created db user');
          })
        })
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
            if (err) {
              db.close();
              return res.json({
                confirmation: 'fail',
                message: 'fail to create db user'
              })
            }

            db.close();
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
      if (err) {
        return res.json({
          confirmation: 'fail',
          message: 'fail to fetch'
        })
      }
      db.close();

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
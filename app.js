const Sequelize = require("sequelize");
const express = require('express');
const bodyParser = require("body-parser");
const path = require("path");
const uuid = require("uuid-v4");
const moment = require("moment-timezone");
const mysql = require('mysql');
const MongoClient = require('mongodb').MongoClient;


// Basic setup
const port = (process.env.PORT || 8888);
const mysql_host = (process.env.MYSQL_SERVICE_HOST || 'localhost');
const mysql_port = (process.env.MYSQL_SERVICE_PORT || 3306);


// Mysql setup
const password = "";
const sequelize = new Sequelize("digitalxi", "root", password, {
  dialect: "mysql",
  dialectOptions: {
    multipleStatements: true
  },
  logging: false,
  define: {
    timestamps: false
  },
  host: mysql_host,
  port: mysql_port,
});


// Routes
const app = express();
app.use(bodyParser.json());

app.get('/mysql_list', async (req, res) => {

  var con = mysql.createConnection({
    host: `${mysql_host}`,
    user: "employee1",
    password: "123456",
    database: "employee1"
  });

  con.connect(function (err) {
    if (err) {
      return res.json({
        confirmation: 'fail',
        err,
      })
    };
    con.query("SELECT * FROM ApiKeys", function (err, result, fields) {
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
    });
  });
});

app.get('/mysql_create', async (req, res) => {

  var con = mysql.createConnection({
    host: `${mysql_host}`,
    user: "employee1",
    password: "123456",
    database: "employee1"
  });

  con.connect(function (err) {
    if (err) {
      return res.json({
        confirmation: 'fail',
        err,
      })
    };
    var sql = `INSERT INTO ApiKeys (KeyGUID, Level, IsActive, Note, IsActivePasscode, Version, CreatedAt, UpdatedAt) VALUES ('123', 1, 1, 'newly insert', 1, '1.0.1', "2000-01-01 12:00:00", "2000-01-01 12:00:00")`;
    con.query(sql, function (err, result) {
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
    });
  });
});


app.get('/test', (req, res) => {

  var con = mysql.createConnection({
    host: `${mysql_host}`,
    user: "root",
    password: password,
  });

  con.connect(function (err) {
    if (err) {
      return res.json({
        confirmation: 'fail',
        config: con.config,
        host: `${mysql_host}:${mysql_port}`,
        err,
        config: sequelize.config
      })
    };
    return res.json({
      confirmation: 'success',
      config: con.config,
      host: `${mysql_host}:${mysql_port}`,
      mysql_host,
      mysql_port,
      config: sequelize.config
    })
  });
});


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

  MongoClient.connect('mongodb://root:root@localhost:27017/', (err, db) => {

    const dbName = uuid();
    const dbOrgName = orgName;
    const dbOrgPassword = '123456';
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
      customData: {
        'userGUID': dbName,
      }
    }, (err, result) => {
      if (err) {
        return res.json({
          confirmation: 'fail',
          message: 'fail to create db user'
        })
      }

      const myobj = { name: "Company Inc", address: "Highway 37" };
      dbo.collection("test").insertOne(myobj, (err, result) => {
        if (err) {
          return res.json({
            confirmation: 'fail',
            message: 'fail to insert data to collection'
          })
        }

        db.close();
        return res.json({
          confirmation: 'success',
          message: 'user and db has been created',
          response: {
            userGUID: dbName
          }
        })
      });
    })
  })
});


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
      userGUID: 'c4a378cb-ce1b-42e0-8212-18eae411ed4f',
      dbOrgName: 'employee1',
      dbOrgPassword: '123456'
    },
    {
      userGUID: 'c9d8c5ea-5e88-4b14-8541-7ba1f08d3a4d',
      dbOrgName: 'employee2',
      dbOrgPassword: '123456'
    }
  ];
  const userFilter = userArr.filter(user => user.userGUID == userGUID);
  if(!userFilter.length){
    return res.json({
      confirmation: 'fail',
      message: 'keycloak authenticated failed'
    })
  } 

  const dbUser = userFilter[0];
  MongoClient.connect(`mongodb://${dbUser.dbOrgName}:${dbUser.dbOrgPassword}@localhost:27017/${dbUser.userGUID}`, (err, db) => {
    if (err) {
      return res.json({
        confirmation: 'fail',
        message: 'fail to connect db'
      })
    }

    const dbo = db.db(dbUser.userGUID);
    const myobj = { name: "Company Inc", address: "Highway 37" };
    dbo.collection("test").insertOne(myobj, (err, result) => {
      if (err) {
        return res.json({
          confirmation: 'fail',
          message: 'fail to insert data to collection'
        })
      }

      db.close();
      return res.json({
        confirmation: 'success',
        message: 'inserted to the corresponding db',
      })
    });    
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
      userGUID: 'c4a378cb-ce1b-42e0-8212-18eae411ed4f',
      dbOrgName: 'employee1',
      dbOrgPassword: '123456'
    },
    {
      userGUID: 'c9d8c5ea-5e88-4b14-8541-7ba1f08d3a4d',
      dbOrgName: 'employee2',
      dbOrgPassword: '123456'
    }
  ];
  const userFilter = userArr.filter(user => user.userGUID == userGUID);
  if(!userFilter.length){
    return res.json({
      confirmation: 'fail',
      message: 'keycloak authenticated failed'
    })
  } 

  const dbUser = userFilter[0];
  MongoClient.connect(`mongodb://${dbUser.dbOrgName}:${dbUser.dbOrgPassword}@localhost:27017/${dbUser.userGUID}`, (err, db) => {
    if (err) {
      return res.json({
        confirmation: 'fail',
        message: 'fail to connect db'
      })
    }

    const dbo = db.db(dbUser.userGUID);
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
    });
  })
})




app.listen(port, () => console.log(`Studio Back End listening on port ${port}!`));

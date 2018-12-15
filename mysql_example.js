const Sequelize = require("sequelize");

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
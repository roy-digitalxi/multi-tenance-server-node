const express = require('express');
const bodyParser = require("body-parser");
const uuid = require("uuid-v4");
const path = require("path");
const moment = require("moment-timezone");
const axios = require("axios");
const qs = require('qs');
const fs = require('fs');
const KeycloakMultirealm = require('keycloak-connect-multirealm');
const session = require('express-session');

const port = (process.env.PORT || 8888);

const memoryStore = new session.MemoryStore();
const config = { store: memoryStore };
// const keycloakConfig = {
//   "auth-server-url": "http://localhost:8080/auth",
//   // 'bearer-only': true,
//   "ssl-required": "external",
//   "resource": "nodejs-connect",
//   "policy-enforcer": {},
//   "confidential-port": 0,
//   "public-client": true,
// };

const keycloakConfig = {
  'auth-server-url': 'http://localhost:8080/auth',
  // 'bearer-only': true,
  'ssl-required': 'external',
  'resource': 'nodejs-connect',
};

const keycloak = new KeycloakMultirealm(config, keycloakConfig);

const app = express();

app.use(session({
  secret: 'mySecret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

app.use(keycloak.middleware());

app.get('/login', keycloak.protect(), (req, res) => {
  return res.json({
    result: JSON.stringify(JSON.parse(req.session['keycloak-token']), null, 4),
  })
})

app.post('/test', keycloak.enforcer(['res1:view'],
  {
    resource_server_id: 'nodejs-apiserver',
    response_mode: 'permissions'
  }
), (req, res) => {

  return res.json({
    message: 'pass'
  })

  // const token = req.kauth.grant.access_token.token;
  // return res.json({
  //   token,
  //   confirmation: 'success'
  // })
})

app.listen(port, () => console.log(`Studio Back End listening on port ${port}!`));

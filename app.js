const express = require('express');
const KeycloakMultirealm = require('keycloak-connect-multirealm');
const session = require('express-session');

const port = (process.env.PORT || 8888);

const memoryStore = new session.MemoryStore();
const config = { store: memoryStore };
const keycloakConfig = {
  "auth-server-url": "http://localhost:8080/auth",
  // 'bearer-only': true,
  "ssl-required": "external",
  "resource": "nodejs-connect",
  "policy-enforcer": {},
  "confidential-port": 0,
  "public-client": true,
};

// Instantiate the class just as the official module. If no keycloakConfig
// is provided, it will read the configuration from keycloak.json file.

const keycloak = new KeycloakMultirealm(config, keycloakConfig);

const app = express();
app.use(keycloak.middleware());

// protect any endpoint
app.get('/login', keycloak.protect(), (req, res) => {
  return res.json({
    message: 'ok'
  });
});

app.listen(port, () => console.log(`Studio Back End listening on port ${port}!`));

const express = require('express');
const bodyParser = require("body-parser");
const uuid = require("uuid-v4");
const path = require("path");
const moment = require("moment-timezone");
const axios = require("axios");
const qs = require('qs');

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
  logout: '/logout',
  admin: '/',
}));


// keycloak test api
app.get('/login', keycloak.protect(), (req, res) => {
  return res.json({
    result: JSON.stringify(JSON.parse(req.session['keycloak-token']), null, 4),
  })
})


// v2
app.post('/admin/create_org', (req, res) => {

  const {
    orgName,
    email,
    firstName,
    lastName,
    password,
  } = req.body;

  if (!orgName) {
    return res.json({
      confirmation: 'fail',
      message: 'orgName is required'
    })
  }
  if (!email) {
    return res.json({
      confirmation: 'fail',
      message: 'email is required'
    })
  }
  if (!firstName) {
    return res.json({
      confirmation: 'fail',
      message: 'firstName is required'
    })
  }
  if (!lastName) {
    return res.json({
      confirmation: 'fail',
      message: 'lastName is required'
    })
  }
  if (!password) {
    return res.json({
      confirmation: 'fail',
      message: 'password is required'
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
          const keyCloakSettings = {
            baseUrl: 'http://127.0.0.1:8080/auth',
            username: 'admin',
            password: 'admin',
            grant_type: 'password',
            client_id: 'admin-cli'
          };
          adminClient(keyCloakSettings)
            .then((client) => {

              client.realms.find()
                .then((keycloakRealms) => {

                  // 4. get unique db name
                  mysqlDbList = mysqlDbList.map(item => item = ({ ...item }));
                  mongoDbList = mongoDbList.databases;
                  generateUniqueDbName(keycloakRealms, mysqlDbList, mongoDbList, (err, dbName) => {
                    if (err) {
                      mysqlCon.end();
                      return res.json({
                        confirmation: 'fail',
                        message: 'fail to generate unique db name'
                      })
                    }

                    mongoCon.close();
                    const dbUserName = dbName;
                    const dbPassword = '123456';

                    const createDbQuery = `CREATE DATABASE ${dbName}`;
                    const createTableQuery = `CREATE TABLE ${dbName}.customers (name VARCHAR(255), address VARCHAR(255))`;
                    const createDbUserQuery = `CREATE USER '${dbUserName}'@'localhost' IDENTIFIED BY '${dbPassword}';`;
                    const addPermissionQuery = `GRANT ALL PRIVILEGES ON ${dbName}.* TO '${dbUserName}'@'localhost';`;

                    // 5. mysql setup
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

                            // 6. mongoDB setup
                            MongoClient.connect(adminPath, { useNewUrlParser: true }, (err, db) => {
                              if (err) {
                                return res.json({
                                  confirmation: 'fail',
                                  message: 'fail to connect db'
                                })
                              }

                              const dbo = db.db(dbName);
                              dbo.addUser(dbUserName, dbPassword, {
                                roles: [
                                  { role: "readWrite", db: dbUserName },
                                  { role: "read", db: dbUserName },
                                  { role: "userAdmin", db: dbUserName },
                                  { role: "dbAdmin", db: dbUserName },
                                  { role: "dbOwner", db: dbUserName },
                                  { role: "enableSharding", db: dbUserName }
                                ],
                              }, (err, result) => {
                                db.close();
                                if (err) {
                                  return res.json({
                                    confirmation: 'fail',
                                    message: 'fail to create db user'
                                  })
                                }

                                // 1. create realm
                                const realmName = dbName;
                                const newRealm = {
                                  realm: realmName,
                                  enabled: true,
                                  registrationAllowed: true,
                                  registrationEmailAsUsername: true,
                                  loginWithEmailAllowed: true,
                                };
                                client.realms.create(newRealm)
                                  .then((createdRealm) => {

                                    // 2. create client
                                    const clientName = 'api_server';
                                    const newClient = {
                                      clientId: clientName,
                                      redirectUris: [
                                        'http://localhost:8888/*'
                                      ],
                                      webOrigins: [
                                        'http://localhost:8888/*'
                                      ],
                                      directAccessGrantsEnabled: true,
                                      serviceAccountsEnabled: true,
                                      authorizationServicesEnabled: true,
                                      fullScopeAllowed: false,
                                      defaultClientScopes: []
                                    };
                                    client.clients.create(createdRealm.realm, newClient)
                                      .then((createdClient) => {

                                        // 3. create realm role
                                        const roleName = 'org_admin';
                                        const newRole = {
                                          name: roleName
                                        };
                                        client.realms.roles.create(createdRealm.realm, newRole)
                                          .then((createdRole) => {

                                            // 4. admin login
                                            let url = `http://localhost:8080/auth/realms/master/protocol/openid-connect/token`;
                                            let params = qs.stringify({
                                              username: 'admin',
                                              password: 'admin',
                                              client_id: 'admin-cli',
                                              grant_type: 'password'
                                            });
                                            axios.post(url, params, {
                                              'Content-Type': 'application/x-www-form-urlencoded;'
                                            })
                                              .then((response) => (response.data))
                                              .then(adminLogin => {

                                                // 5. create client scope
                                                const { access_token } = adminLogin;
                                                url = `http://localhost:8080/auth/admin/realms/${createdRealm.realm}/client-scopes`;
                                                const newClientScopeName = 'client_attribute_scope';
                                                const newClientScope = {
                                                  attributes: {
                                                    "display.on.consent.screen": true
                                                  },
                                                  name: newClientScopeName,
                                                  protocol: "openid-connect"
                                                };

                                                axios.post(url, newClientScope, {
                                                  headers: { 'Authorization': "Bearer " + access_token }
                                                })
                                                  .then((response) => (response.headers.location))
                                                  .then((location) => {

                                                    // 6. create mapper to add attribute in client scope
                                                    const createdClientScope = location.split("/");
                                                    const createdClientScopeId = createdClientScope[createdClientScope.length - 1];
                                                    url = `${location}/protocol-mappers/models`;
                                                    const newClientScopeMapper1 = {
                                                      config: {
                                                        "access.token.claim": "true",
                                                        "claim.name": "dbName",
                                                        "id.token.claim": "true",
                                                        "jsonType.label": "String",
                                                        "multivalued": "",
                                                        "user.attribute": "dbName",
                                                        "userinfo.token.claim": "true"
                                                      },
                                                      name: "dbName",
                                                      protocol: "openid-connect",
                                                      protocolMapper: "oidc-usermodel-attribute-mapper"
                                                    };
                                                    const newClientScopeMapper2 = {
                                                      config: {
                                                        "access.token.claim": "true",
                                                        "claim.name": "dbPassword",
                                                        "id.token.claim": "true",
                                                        "jsonType.label": "String",
                                                        "multivalued": "",
                                                        "user.attribute": "dbPassword",
                                                        "userinfo.token.claim": "true"
                                                      },
                                                      name: "dbPassword",
                                                      protocol: "openid-connect",
                                                      protocolMapper: "oidc-usermodel-attribute-mapper"
                                                    };
                                                    const newClientScopeMapper3 = {
                                                      config: {
                                                        "access.token.claim": "true",
                                                        "claim.name": "orgName",
                                                        "id.token.claim": "true",
                                                        "jsonType.label": "String",
                                                        "multivalued": "",
                                                        "user.attribute": "orgName",
                                                        "userinfo.token.claim": "true"
                                                      },
                                                      name: "orgName",
                                                      protocol: "openid-connect",
                                                      protocolMapper: "oidc-usermodel-attribute-mapper"
                                                    };
                                                    // 6.1
                                                    axios.post(url, newClientScopeMapper1, {
                                                      headers: { 'Authorization': "Bearer " + access_token }
                                                    })
                                                      .then((response) => (response.data))
                                                      .then(() => {
                                                        // 6.2
                                                        axios.post(url, newClientScopeMapper2, {
                                                          headers: { 'Authorization': "Bearer " + access_token }
                                                        })
                                                          .then((response) => (response.data))
                                                          .then(() => {
                                                            // 6.3
                                                            axios.post(url, newClientScopeMapper3, {
                                                              headers: { 'Authorization': "Bearer " + access_token }
                                                            })
                                                              .then((response) => (response.data))
                                                              .then(() => {

                                                                // 7. add client scope to client
                                                                url = `http://localhost:8080/auth/admin/realms/${createdRealm.realm}/clients/${createdClient.id}/default-client-scopes/${createdClientScopeId}`;
                                                                const updateClient = {
                                                                  client: createdClient.id,
                                                                  clientScopeId: createdClientScopeId,
                                                                  realm: createdRealm.realm
                                                                };
                                                                axios.put(url, updateClient, {
                                                                  headers: { 'Authorization': "Bearer " + access_token }
                                                                })
                                                                  .then((response) => (response.data))
                                                                  .then(() => {

                                                                    // 8. authorization
                                                                    // 8.1 scope
                                                                    // 8.2 resource
                                                                    // 8.3 policy
                                                                    // 8.4 permission
                                                                    url = `http://localhost:8080/auth/admin/realms/${createdRealm.realm}/clients/${createdClient.id}/authz/resource-server/scope`;
                                                                    const newAuthScope = {
                                                                      name: "create"
                                                                    };
                                                                    axios.post(url, newAuthScope, {
                                                                      headers: { 'Authorization': "Bearer " + access_token }
                                                                    })
                                                                      .then((response) => (response.data))
                                                                      .then((createdAuthScope) => {

                                                                        url = `http://localhost:8080/auth/admin/realms/${createdRealm.realm}/clients/${createdClient.id}/authz/resource-server/resource`;
                                                                        const authResourceName = 'res1'
                                                                        const newAuthResource = {
                                                                          attributes: {},
                                                                          displayName: authResourceName,
                                                                          name: authResourceName,
                                                                          ownerManagedAccess: "",
                                                                          scopes: [
                                                                            createdAuthScope
                                                                          ],
                                                                          uris: []
                                                                        };
                                                                        axios.post(url, newAuthResource, {
                                                                          headers: { 'Authorization': "Bearer " + access_token }
                                                                        })
                                                                          .then((response) => (response.data))
                                                                          .then((createdAuthResource) => {

                                                                            url = `http://localhost:8080/auth/admin/realms/${createdRealm.realm}/clients/${createdClient.id}/authz/resource-server/policy/role`;
                                                                            const authPolicyName = 'policy1'
                                                                            const newAuthPolicy = {
                                                                              decisionStrategy: "UNANIMOUS",
                                                                              logic: "POSITIVE",
                                                                              name: authPolicyName,
                                                                              roles: [
                                                                                {
                                                                                  "id": createdRole.id,
                                                                                  "required": true
                                                                                }
                                                                              ],
                                                                              type: "role"
                                                                            };
                                                                            axios.post(url, newAuthPolicy, {
                                                                              headers: { 'Authorization': "Bearer " + access_token }
                                                                            })
                                                                              .then((response) => (response.data))
                                                                              .then((createdAuthPolicy) => {

                                                                                url = `http://localhost:8080/auth/admin/realms/${createdRealm.realm}/clients/${createdClient.id}/authz/resource-server/permission/resource`;
                                                                                const authPermissionName = 'permission1'
                                                                                const newAuthPermission = {
                                                                                  decisionStrategy: "UNANIMOUS",
                                                                                  logic: "POSITIVE",
                                                                                  name: authPermissionName,
                                                                                  policies: [createdAuthPolicy.id],
                                                                                  resources: [createdAuthResource._id],
                                                                                  type: "resource"
                                                                                };
                                                                                axios.post(url, newAuthPermission, {
                                                                                  headers: { 'Authorization': "Bearer " + access_token }
                                                                                })
                                                                                  .then((response) => (response.data))
                                                                                  .then((createdAuthPermission) => {

                                                                                    // 9. create org admin user
                                                                                    let user = {
                                                                                      username: email,
                                                                                      email,
                                                                                      firstName,
                                                                                      lastName,
                                                                                      emailVerified: false,
                                                                                      enabled: true,
                                                                                      attributes: {
                                                                                        orgName,
                                                                                        dbUserName,
                                                                                        dbPassword: '123456'
                                                                                      }
                                                                                    };
                                                                                    client.users.create(createdRealm.realm, user)
                                                                                      .then((newUser) => {
                                                                                        const updateUser = {
                                                                                          type: 'password',
                                                                                          value: password
                                                                                        };
                                                                                        client.users.resetPassword(createdRealm.realm, newUser.id, updateUser)
                                                                                          .then(() => {

                                                                                            // 10. add realm role to keycloak user
                                                                                            client.realms.maps.map(createdRealm.realm, newUser.id,
                                                                                              [
                                                                                                {
                                                                                                  id: createdRole.id,
                                                                                                  name: newRole.name
                                                                                                },
                                                                                              ])
                                                                                              .then(() => {

                                                                                                // 11. add realm management to keycloak user
                                                                                                client.clients.find(createdRealm.realm, { clientId: 'realm-management' })
                                                                                                  .then(realmManagementClient => {

                                                                                                    if(!realmManagementClient.length){
                                                                                                      console.log('fail, cannot find the realm management client');
                                                                                                      return;
                                                                                                    }
                                                                                                    const realmManagementClientId = realmManagementClient[0].id;
                                                                                                    client.clients.roles.find(createdRealm.realm, realmManagementClientId)
                                                                                                      .then((clientRoles) => {
                                                                                                        
                                                                                                        url = `http://localhost:8080/auth/admin/realms/${createdRealm.realm}/users/${newUser.id}/role-mappings/clients/${realmManagementClientId}`;
                                                                                                        axios.post(url, clientRoles, {
                                                                                                          headers: { 
                                                                                                            'Authorization': "Bearer " + access_token
                                                                                                          }
                                                                                                        })
                                                                                                          .then(() => {
                                                                                                            return res.json({
                                                                                                              newUser
                                                                                                            })
                                                                                                          })
                                                                                                          .catch(err => {
                                                                                                            return res.json({
                                                                                                              confirmation: 'fail',
                                                                                                              message: 'fail to add realm client role to user'
                                                                                                            })
                                                                                                          })
                                                                                                      })
                                                                                                      .catch(err => {
                                                                                                        return res.json({
                                                                                                          confirmation: 'fail',
                                                                                                          message: 'fail to get realm client roles'
                                                                                                        })
                                                                                                      })
                                                                                                  })
                                                                                                  .catch(err => {
                                                                                                    return res.json({
                                                                                                      confirmation: 'fail',
                                                                                                      message: 'fail to get realm client'
                                                                                                    })
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
                                                                                  .catch((err) => {
                                                                                    return res.json({
                                                                                      confirmation: 'fail',
                                                                                      message: 'fail to create auth permission'
                                                                                    })
                                                                                  })
                                                                              })
                                                                              .catch((err) => {
                                                                                return res.json({
                                                                                  confirmation: 'fail',
                                                                                  message: 'fail to create auth policy'
                                                                                })
                                                                              })
                                                                          })
                                                                          .catch((err) => {
                                                                            return res.json({
                                                                              confirmation: 'fail',
                                                                              message: 'fail to create auth resource'
                                                                            })
                                                                          })
                                                                      })
                                                                      .catch((err) => {
                                                                        return res.json({
                                                                          confirmation: 'fail',
                                                                          message: 'fail to create auth scope'
                                                                        })
                                                                      })
                                                                  })
                                                                  .catch((err) => {
                                                                    return res.json({
                                                                      confirmation: 'fail',
                                                                      message: 'fail to add client scope to client'
                                                                    })
                                                                  })
                                                              })
                                                              .catch((err) => {
                                                                return res.json({
                                                                  confirmation: 'fail',
                                                                  message: 'fail to create client scope mapper'
                                                                })
                                                              })
                                                          })
                                                          .catch((err) => {
                                                            return res.json({
                                                              confirmation: 'fail',
                                                              message: 'fail to create client scope mapper'
                                                            })
                                                          })
                                                      })
                                                      .catch((err) => {
                                                        return res.json({
                                                          confirmation: 'fail',
                                                          message: 'fail to create client scope mapper'
                                                        })
                                                      })
                                                  })
                                                  .catch((err) => {
                                                    return res.json({
                                                      confirmation: 'fail',
                                                      message: 'fail to create client scope'
                                                    })
                                                  })
                                              })
                                              .catch((err) => {
                                                return res.json({
                                                  confirmation: 'fail',
                                                  message: 'fail to admin login'
                                                })
                                              })
                                          })
                                          .catch((err) => {
                                            return res.json({
                                              confirmation: 'fail',
                                              message: 'fail to create realm role'
                                            })
                                          })
                                      })
                                      .catch((err) => {
                                        return res.json({
                                          confirmation: 'fail',
                                          message: 'fail to create client'
                                        })
                                      })
                                  })
                                  .catch((err) => {
                                    return res.json({
                                      confirmation: 'fail',
                                      message: 'fail to create realm'
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
                  return res.json({
                    confirmation: 'fail',
                    message: 'fail to get keycloak realms'
                  })
                })
            })
            .catch((err) => {
              return res.json({
                confirmation: 'fail',
                message: 'fail to admin login'
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

  const filterArr1 = arr1.filter(db => db.realm == dbName);
  const filterArr2 = arr2.filter(db => db.Database == dbName);
  const filterArr3 = arr3.filter(db => db.name == dbName);
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

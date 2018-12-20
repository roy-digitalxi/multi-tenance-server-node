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
      const realmName = 'new_realm_1';
      const newRealm = {
        realm: realmName,
        enabled: true,
        registrationAllowed: true
      };
      client.realms.create(newRealm)
        .then((createdRealm) => {

          // 2. create client
          const clientName = 'new_client_1';
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
              const roleName = 'new_role_1';
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
                      const newClientScopeName = 'new_client_scope_1';
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

                                                    // org admin user
                                                  })
                                                  .catch((err) => {
                                                    console.log('err: ', err);
                                                  })
                                                })
                                                .catch((err) => {
                                                  console.log('err: ', err);
                                                })
                                            })
                                            .catch((err) => {
                                              console.log('err: ', err);
                                            })
                                        })
                                        .catch((err) => {
                                          console.log('err: ', err);
                                        })
                                    })
                                    .catch((err) => {
                                      console.log('err: ', err);
                                    })
                                })
                                .catch((err) => {
                                  console.log('err: ', err);
                                })
                            })
                            .catch((err) => {
                              console.log('err: ', err);
                            })
                        })
                        .catch((err) => {
                          console.log('err: ', err);
                        })
                    })
                    .catch((err) => {
                      console.log('err: ', err);
                    })
                })
                .catch((err) => {
                  console.log('err: ', err);
                })
            })
            .catch((err) => {
              console.log('err: ', err);
            })
        })
        .catch((err) => {
          console.log('err: ', err);
        })

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

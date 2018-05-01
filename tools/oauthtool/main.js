const electron = require('electron');
const { session } = require('electron');
const ejse = require('ejs-electron');

// Module to control application life.
const app = electron.app;
const protocol = electron.protocol;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const URL = require('url');
const queryString = require('query-string');

const rp = require('request-promise');
const crypto = require('crypto');

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// Please update  your clientID ( Application ID displayed in mimik developer portal for the app )

let devClientId = '';
// const devClientId = process.env.CLIENT_ID; //'test';

// Please update  your ridirect url  ( use ridirect uri entered in mimik developer portal for the app )

// const devRidirectUri = process.env.REDIRECT_URI;
const devRidirectUri = 'com.mimik://authorization_code';


////////////////////////////////////////////////

const OAUTH_DOMAIN = 'https://mid.mimik360.com';
const SCOPES = [
      //  'write:me', 
      //  'read:users',
      //  'read:friendList',
      //  'delete:friend',        
      //  'read:requestFriendList',
      //  'read:friendRequestList',
      //  'add:requestFriend',
      //  'delete:requestFriend',
      //  'update:friendRequest',
      //  'delete:friendRequest',
      //  'update:me',
      //  'create:app',
      //  'delete:app',
      // 'read:me',
       'edge:mcm',
       'edge:clusters',
       'edge:account:associate',
       'openid', ];

const RESET_SCOPES = [
        'openid',
        'edge:account:unassociate',
];

ejse.data('redirectURI', devRidirectUri);
ejse.data('clientId', devClientId);
ejse.data('oauthDomain', OAUTH_DOMAIN);
ejse.data('oauthScope', SCOPES.map(u => encodeURIComponent(u)).join('+'));
ejse.data('oauthResetScope', RESET_SCOPES.map(u => encodeURIComponent(u)).join('+'));

///////////////////////////////////////////////

function base64URLEncode(str) {
  return str.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
}

const verifier = base64URLEncode(crypto.randomBytes(32));

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

function createWindow () {
  // Create the browser window.

  protocol.registerHttpProtocol('openid', (request, callback) => {
    const _url = request.url.substr('openid://'.length);
    const query = queryString.parse(_url.replace('callback?', ''));

    devClientId = query.client_id;
    
    ejse.data('clientId', devClientId);

    const oauthScope = query.reset ? 
      RESET_SCOPES.map(u => encodeURIComponent(u)).join('+') :
      SCOPES.map(u => encodeURIComponent(u)).join('+');

    const redirect = encodeURIComponent(devRidirectUri);
    const url = `${OAUTH_DOMAIN}/auth?redirect_uri=${redirect}&scope=${oauthScope}&client_id=${devClientId}&state=xyz&response_type=code&code_challenge=czD7gtNh2SowYqxpN5OSf5a6wIiszEZ9AvRHGvwIJS4&code_challenge_method=S256`;

    mainWindow.loadURL(url);
  });

  protocol.registerHttpProtocol('com.mimik', (request, callback) => {
    const url = request.url.substr(12);
    const query = queryString.parse(url.replace('authorization_code?', ''));

    console.log(`url: ${url}`);
    console.log(`code: ${query.code}, state: ${query.state}`);

    if (!query.code) {
      const loginUrl = URL.format({
        pathname: path.join(__dirname, 'index.ejs'),
        protocol: 'file:',
        slashes: true,
        hash: `error-${JSON.stringify(query)}`,
      });

      mainWindow.loadURL(loginUrl);
    }

    var options = {
      method: 'POST',
      uri: `${OAUTH_DOMAIN}/token`,
      form: {
        grant_type: 'authorization_code',
        code: query.code,
        redirect_uri: devRidirectUri,
        client_id: devClientId,
        code_verifier: 'SqRg3wQWke2YSwMydkdilNHURfmmnt-Vlbvf8s2Ri58'
      }
    };

    rp(options)
      .then((parsedBody) => {
        const token = JSON.parse(parsedBody);
        console.log(`rp: ${JSON.stringify(token, null, 2)}`);
        session.defaultSession.cookies.get({}, (error, cookies) => {
          console.log(error, cookies)
        });

        const loginUrl = URL.format({
          pathname: path.join(__dirname, 'index.ejs'),
          protocol: 'file:',
          slashes: true,
          hash: parsedBody,
        });

        mainWindow.loadURL(loginUrl);
        // callback({path: path.normalize(`${__dirname}/login.html`)});
      })
      .catch((err) => {
        console.log(`${err}`);
        callback({path: path.normalize(`${__dirname}/error.html`)});
      });

  }, (error) => {
    if (error) console.error('Failed to register protocol');
  });

  mainWindow = new BrowserWindow({width: 800, height: 600, webPreferences: {
    nativeWindowOpen: true
  }});

  // and load the index.html of the app.
  mainWindow.loadURL(URL.format({
    pathname: path.join(__dirname, 'index.ejs'),
    protocol: 'file:',
    slashes: true
  }));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()

  // Emitted when the window is closed.
  mainWindow.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

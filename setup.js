require('dotenv').config();

const fs = require('fs');

const { Vonage } = require('@vonage/server-sdk');

let vonage;

console.log('setup.js running...');
if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET) {
  // If the environment variables are already set, use them
  console.log('Environment variables already set. Skipping setup.');
  process.exit();  
}
   
let step = 'SET_API_KEY';
console.log('Vonage setup utility for Github Codespaces -- press "q" to exit');
console.log('This utility will need your Vonage API key and API secret. They will be saved to your .env file,');
console.log('where they will be visible only to you and collaborators on this project.');
console.log('Find your API key and secret at: https://dashboard.vonage.com/getting-started-guide');
console.log('process.env.CODESPACE_NAME: ', process.env.CODESPACE_NAME);
console.log('Enter your API Key:');
let input = process.stdin;
input.on('data', data => {
  
  if (data.toString().trim() === 'q') {
    // exit 
    return process.exit();
  }
  
  switch (step) {
    case 'SET_API_KEY':
      return setApiKey(data);
      break;
    case 'SET_API_SECRET':
      return setApiSecret(data);
      break;
    case 'SET_APP_NAME':
      return setAppName(data);
      break;
    case 'AZURE_SUBSCRIPTION_KEY':
      return setAzureSubscriptionKey(data);
      break;
    case 'AZURE_SERVICE_REGION':
      return setAzureServiceRegion(data);
      break;
    case 'SET_AZURE_LANGUAGE':
      return setAzureLanguage(data);
      break;
    default:
  }
  

});

function setApiKey(data) {
  if (data.toString().replace(/\n/g, '').length === 0 || data.toString().replace(/\n/g, '') === ' ') {
    console.log('(Can not be blank.) Enter you API key:');
  } else {
    process.env.VONAGE_API_KEY = data.toString().replace(/\n/g, '');
    step = 'SET_API_SECRET';
    console.log('Enter you API secret:');
  }
  return true;
}

function setApiSecret(data) {
  if (data.toString().replace(/\n/g, '').length === 0 || data.toString().replace(/\n/g, '') === ' ') {
    console.log('(Can not be blank.) Enter you API secret:');
  } else {
    process.env.VONAGE_API_SECRET = data.toString().replace(/\n/g, '');
    step = 'SET_APP_NAME';
    console.log('Enter a name for your Application:');
  }
  return true;
}

function setAppName(data) {
  if (data.toString().replace(/\n/g, '').length === 0 || data.toString().replace(/\n/g, '') === ' ') {
    console.log('(Can not be blank.) Enter a name for your Application:');
  } else {
    createApp(data); 

  }
  return true;
}

function setAzureSubscriptionKey(data) {
  if (data.toString().replace(/\n/g, '').length === 0 || data.toString().replace(/\n/g, '') === ' ') {
    console.log('(Can not be blank.) Enter Azure Subscription Key:');
  } else {
    process.env.AZURE_SUBSCRIPTION_KEY = data.toString().replace(/\n/g, '');
    step = 'AZURE_SERVICE_REGION';
    console.log('Enter Azure Service Region (ex. westus):');
  } 
  return true;
}

function setAzureServiceRegion(data) {
  if (data.toString().replace(/\n/g, '').length === 0 || data.toString().replace(/\n/g, '') === ' ') {
    console.log('(Can not be blank.) Enter Azure Service Region (ex. westus):');
  } else {
    process.env.AZURE_SERVICE_REGION = data.toString().replace(/\n/g, '');
    step = 'SET_AZURE_LANGUAGE';
    console.log('Enter default target language (ex. fr):');
  }
  return true;
}

function setAzureLanguage(data) {
  if (data.toString().replace(/\n/g, '').length === 0 || data.toString().replace(/\n/g, '') === ' ') {
    console.log('(Can not be blank.) Enter default target language (ex. fr):');
  } else {
    process.env.DEFAULT_TARGET_LANGUAGE = data.toString().replace(/\n/g, '');
    writeEnv();
  }
  return true;
}

function createApp(data) {
  console.log('Creating your Application...');
  vonage = new Vonage({
    apiKey: process.env.VONAGE_API_KEY,
    apiSecret: process.env.VONAGE_API_SECRET
  }, {
      debug: false
  });

  vonage.applications.createApplication({
      name: data.toString().replace(/\n/g, ''),
      capabilities: {
          voice: {
              webhooks: {
                  answer_url: {
                      address: `https://${process.env.CODESPACE_NAME}.github.dev/webhooks/answer`,
                      http_method: "GET"
                  },
                  event_url: {
                      address: `https://${process.env.CODESPACE_NAME}.github.dev/webhooks/event`,
                      http_method: "POST"
                  }
              }
          },
          messages: {
              webhooks: {
                  inbound_url: {
                      address: `https://${process.env.CODESPACE_NAME}.github.dev/webhooks/inbound`,
                      http_method: "POST"
                  },
                  status_url: {
                      address: `https://${process.env.CODESPACE_NAME}.github.dev/webhooks/status`,
                      http_method: "POST"
                  }
              }
          },
          rtc: {
              webhooks: {
                  event_url: {
                      address: `https://${process.env.CODESPACE_NAME}.github.dev/webhooks/rtcevent`,
                      http_method: "POST"
                  }
              }
          }
      }
  }).then((app) => {
      console.log('Application created with ID: ', app.id);
      process.env.VONAGE_APP_ID = app.id;
      fs.writeFile(__dirname + '/private.key', app.keys.private_key, (err) => {
        if (err) {
          console.log('Error writing private key: ', err);
        } else {
          console.log('Private key saved to private.key');
          try {
            // convert private.key to base64
            console.log('Converting private key to base64...');
            const privateKey = fs.readFileSync(__dirname + '/private.key');
            const base64PrivateKey = privateKey.toString('base64');
            process.env.PRIVATE_KEY64 = base64PrivateKey;
            process.env.VONAGE_APPLICATION_NAME = data.toString().replace(/\n/g, '');
            step = 'AZURE_SUBSCRIPTION_KEY';
            console.log('Enter Azure Subscription Key:');
          } catch (error) {
            console.error('An error occurred:', error);
          }
        }
      });
  }).catch((error) => {
      console.error('Error creating Application: ', error);
      process.exit();
  });
  return true;  
}

function writeEnv() {
  const contents = `VONAGE_API_KEY="${process.env.VONAGE_API_KEY}"
VONAGE_API_SECRET="${process.env.VONAGE_API_SECRET}"
VONAGE_APPLICATION_NAME="${process.env.VONAGE_APPLICATION_NAME}"
VONAGE_APP_ID="${process.env.VONAGE_APP_ID}"
VONAGE_PRIVATE_KEY64="${process.env.PRIVATE_KEY64}"
APP_DOMAIN="${process.env.CODESPACE_NAME}.app.github.dev"
AZURE_SUBSCRIPTION_KEY="${process.env.AZURE_SUBSCRIPTION_KEY}"
AZURE_SERVICE_REGION="${process.env.AZURE_SERVICE_REGION}"
DEFAULT_TARGET_LANGUAGE="${process.env.DEFAULT_TARGET_LANGUAGE}"`;

  fs.writeFile(__dirname + '/.env', contents, (err) => {
    if (err) {
      console.log('Error writing .env file: ',err);
    } else {
      console.log('Environment variables saved to .env');
      process.exit();
    }
  });

}

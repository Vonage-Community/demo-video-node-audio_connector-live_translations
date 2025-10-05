"use strict";
require('dotenv').config();
const fs = require("fs");
const express = require("express");
const sdk = require("microsoft-cognitiveservices-speech-sdk");

const { Vonage } = require('@vonage/server-sdk');
const { tokenGenerate } = require('@vonage/jwt')

const app = express();
app.use(express.json());
const port = 8080;
const path = require("path");
const expressWs = require("express-ws")(app);

app.use(express.static("static"));

const appId = process.env.VONAGE_APP_ID;
let privateKey;

if (process.env.PRIVATE_KEY) {
  try {
      privateKey = fs.readFileSync(process.env.VONAGE_PRIVATE_KEY, 'utf8');
  } catch (error) {
      // PRIVATE_KEY entered as a single line string
      privateKey = process.env.VONAGE_PRIVATE_KEY.replace(/\\n/g, '\n');
  }
} else if (process.env.VONAGE_PRIVATE_KEY64){
  privateKey = Buffer.from(process.env.VONAGE_PRIVATE_KEY64, 'base64');
}

const subscriptionKey = process.env.AZURE_SUBSCRIPTION_KEY;
const serviceRegion = process.env.AZURE_SERVICE_REGION;
const websocketURI = `wss://${process.env.APP_DOMAIN}`;
const defaultTargetLanguage = process.env.DEFAULT_TARGET_LANGUAGE;


const targetLanguagesToAdd = new Set();
targetLanguagesToAdd.add(defaultTargetLanguage);

// Verify that the credentials are defined
if (
  !appId  ||
  !privateKey ||
  !subscriptionKey ||
  !serviceRegion ||
  !websocketURI ||
  !defaultTargetLanguage
) {
  console.log("You must specify all values in .env");
  console.log({ appId, privateKey, subscriptionKey, serviceRegion, websocketURI, defaultTargetLanguage });
  process.exit(1);
}

// Initialize the Vonage SDK
const vonageCredentials = {
  applicationId: appId,
  privateKey: privateKey
};
const vonage = new Vonage(vonageCredentials);

app.get("/", (req, res) => {
  res.sendFile(path.resolve("pages/index.html"));
});

app.get("/session", async (req, res) => {
  console.log("/session");
  const sessionId = app.get("sessionId");
  const token = vonage.video.generateClientToken(sessionId, { role: 'moderator' });
  res.setHeader("Content-Type", "application/json");
  res.send({
    applicationId: appId,
    sessionId,
    token,
  });
});

app.post("/connect", async (req, res) => {
  console.log("/connect");
  const sessionId = app.get("sessionId");
  const { streamId, connectionId, speaker, spoken } = req.body;
  console.log({ streamId, connectionId, speaker, spoken });
  try {
    const token = tokenGenerate(appId, privateKey);
    const webSocketToken = vonage.video.generateClientToken(sessionId, { role: 'publisher' });
    const audioConnectorResponse = await fetch(`https://video.api.vonage.com/v2/project/${appId}/connect`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        "sessionId": sessionId,
        "token": webSocketToken,
        "websocket": {
          "uri": `${websocketURI}/socket/${connectionId}/${speaker.replaceAll(" ","_")}/${spoken}`,
          "streams": [streamId],
          "audioRate": 16000,
          "bidirectional": false
        }
      })
    })
    console.log(`${websocketURI}/socket/${connectionId}/${speaker.replaceAll(" ","_")}/${spoken}`)
    const audioConnectorResponseJson = await audioConnectorResponse.json();
    console.log("Audio Connector WebSocket connected: ", audioConnectorResponseJson);
    res.send(audioConnectorResponseJson);
  } catch (error) {
    console.error("Error starting Audio Connector: ",error);
    res.status(500).send(`Error starting Audio Connector: ${error}`);
  }
});

app.get("/disconnect/:connectionId", async (req, res) => {
  console.log("/disconnect: ", req.params.connectionId);
  const sessionId = app.get("sessionId");
  try {
    await vonage.video.disconnectClient(sessionId, req.params.connectionId);
    console.log("Successfully disconnected Audio Connector");
      res.setHeader("Content-Type", "application/json");
      res.send({
        status: `connection ${req.params.connectionId} disconnected`,
      });

  } catch (error) {
    console.error("Error starting Audio Connector: ",error);
    res.status(500).send(`Error stopping Audio Connector: ${error}`);
  }
});

app.post("/translate", (req, res) => {
  console.log("/translate");
  targetLanguagesToAdd.add(req.body.target);
  res.setHeader("Content-Type", "application/json");
  res.send({
    status: "started",
  });
});

app.ws("/socket/:connectionId/:speaker/:spoken", (ws, req) => {
  console.log('app.ws')
  const sessionId = app.get("sessionId");
  const speechTranslationConfig = sdk.SpeechTranslationConfig.fromSubscription(
    subscriptionKey,
    serviceRegion
  );
  speechTranslationConfig.speechRecognitionLanguage = req.params.spoken;
  speechTranslationConfig.addTargetLanguage(defaultTargetLanguage);
  const pushStream = sdk.AudioInputStream.createPushStream();
  const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  const recognizer = new sdk.TranslationRecognizer(
    speechTranslationConfig,
    audioConfig
  );

  recognizer.recognized = async function (s, e) {
    console.log("recognized connectionId: ", req.params.connectionId);
    // Note: Can not get all translations at once: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-translate-speech?tabs=terminal&pivots=programming-language-javascript#choose-one-or-more-target-languages
    targetLanguagesToAdd.forEach((lang) => {
      recognizer.addTargetLanguage(lang);
    });
    let translations = {};
    recognizer.targetLanguages.forEach((lang) => {
      translations[lang] = e.result.translations.get(lang);
    });
    console.log("translations: ", translations);

    try {
      const signalResponse = await vonage.video.sendSignal({ 
        type: "translation", 
        data: JSON.stringify({
          speaker: req.params.speaker,
          translations,
        }),
      }, sessionId);
      console.log("Successfully sent signal:", signalResponse);
    } catch(error) {
        console.error("Error sending signal:", error);
    }
  };
  recognizer.startContinuousRecognitionAsync(
    function (result) {
      console.log("result: ", result);
    },
    function (err) {
      console.log("err: ", err);
      recognizer.close();
      recognizer = undefined;
    }
  );

  ws.on("message", (msg) => {
    try {
      const msgJSON = JSON.parse(msg);
      console.log(
        `/socket/${req.params.connectionId}/${req.params.speaker}/${req.params.spoken}: `,
        msgJSON
      );
    } catch (err) {
      pushStream.write(msg);
    }
  });
});

async function init() {
  try {
    // Create a session and store session ID in the express app
    const sessionOptions = {
      mediaMode: "routed",
    };
    const session = await vonage.video.createSession(sessionOptions);
    // save the sessionId
    app.set("sessionId", session.sessionId);
    await app.listen(port);
    console.log(`Example app listening at http://localhost:${port}`);
  } catch(error) {
    console.error("Error creating session: ", error);
  }
}

init();
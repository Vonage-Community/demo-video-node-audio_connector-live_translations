"use strict";
require('dotenv').config();
// const credentials = require("./credentials");
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
// const { createServer } = require('http');
// const { WebSocketServer } = require('ws');
// const server = createServer(app);
// const wss = new WebSocketServer({ server });

app.use(express.static("static"));

// const fs = require('fs');

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

// const apiKey = credentials.VONAGE_API_KEY;
// const apiSecret = credentials.VONAGE_API_SECRET;
// const subscriptionKey = credentials.AZURE_SUBSCRIPTION_KEY;
// const serviceRegion = credentials.AZURE_SERVICE_REGION;
// const websocketURI = `wss://${credentials.APP_DOMAIN}`;
// const defaultTargetLanguage = credentials.DEFAULT_TARGET_LANGUAGE;

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

// const opentok = new OpenTok(apiKey, apiSecret);

const vonageCredentials = {
  applicationId: appId,
  privateKey: privateKey
};
const vonage = new Vonage(vonageCredentials);


// Create a session and store session ID in the express app
const sessionOptions = {
  mediaMode: "routed",
};

// opentok.createSession(sessionOptions, (err, session) => {
//   if (err) throw err;
//   app.set("sessionId", session.sessionId);
//   // We will wait on starting the app until this is done
//   init();
// });

// try {
//   const session = await vonage.video.createSession(sessionOptions);
//   // save the sessionId
//   app.set("sessionId", session.sessionId);
//   // We will wait on starting the app until this is done
//   init();

// } catch(error) {
//   console.error("Error creating session: ", error);
// }

app.get("/", (req, res) => {
  res.sendFile(path.resolve("pages/index.html"));
});

app.get("/session", async (req, res) => {
  console.log("/session");
  const sessionId = app.get("sessionId");
  // const token = opentok.generateToken(sessionId);
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
  // const sessionId = app.get("sessionId");
  // const token = opentok.generateToken(sessionId);
  // const { streamId, connectionId, speaker, spoken } = req.body;
  // console.log({ streamId, connectionId, speaker, spoken });
  // opentok.websocketConnect(
  //   sessionId,
  //   token,
  //   `${websocketURI}/socket/${connectionId}/${speaker.replaceAll(
  //     " ",
  //     "_"
  //   )}/${spoken}`,
  //   { streams: [streamId] },
  //   function (error, socket) {
  //     if (error) {
  //       console.log("Error:", error.message);
  //       res.setHeader("Content-Type", "application/json");
  //       res.send({ error: error.message });
  //     } else {
  //       console.log("Audio Connector WebSocket connected: ", socket);
  //       res.setHeader("Content-Type", "application/json");
  //       res.send({
  //         socket,
  //       });
  //     }
  //   }
  // );
});

app.get("/disconnect/:connectionId", async (req, res) => {
  console.log("/disconnect: ", req.params.connectionId);
  const sessionId = app.get("sessionId");
  // const { sessionId } = req.body;
  try {
    await vonage.video.disconnectClient(sessionId, req.params.connectionId);
    console.log("Successfully disconnected Audio Connector");
    // res.sendStatus(204)
          res.setHeader("Content-Type", "application/json");
      res.send({
        status: `connection ${req.params.connectionId} disconnected`,
      });

  } catch (error) {
    console.error("Error starting Audio Connector: ",error);
    res.status(500).send(`Error stopping Audio Connector: ${error}`);
  }
  // const sessionId = app.get("sessionId");
  // opentok.forceDisconnect(sessionId, req.params.connectionId, (error) => {
  //   if (error) {
  //     console.log("Error:", error.message);
  //     res.setHeader("Content-Type", "application/json");
  //     res.send({ error: error.message });
  //   } else {
  //     res.setHeader("Content-Type", "application/json");
  //     res.send({
  //       status: `connection ${req.params.connectionId} disconnected`,
  //     });
  //   }
  // });
});

app.post("/translate", (req, res) => {
  console.log("/translate");
  targetLanguagesToAdd.add(req.body.target);
  res.setHeader("Content-Type", "application/json");
  res.send({
    status: "started",
  });
});




// wss.on("connection", (ws, req) => {
//   // Parse the path from the request URL
//   const url = req.url || '/';
//   console.log('WebSocket connection established on path:', url);
//   // Example: handle only /socket/:connectionId/:speaker/:spoken
//   const socketPathRegex = /^\/socket\/([^/]+)\/([^/]+)\/([^/]+)$/;
//   const match = url.match(socketPathRegex);
//   if (match) {
//     const [_, connectionId, speaker, spoken] = match;
//     ws.connectionId = connectionId;
//     ws.speaker = speaker;
//     ws.spoken = spoken;
//     console.log('Parsed WebSocket params:', { connectionId, speaker, spoken });
//     // You can add further handling here for this path
//   } else {
//     console.log('WebSocket connection on unrecognized path:', url);
//   }
//   // Optionally, handle messages
//   ws.on('message', (msg) => {
//     console.log('Received message on', url, ':', msg.toString());
//   });
// });

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
    // opentok.signal(
    //   sessionId,
    //   null,
    //   {
    //     type: "translation",
    //     data: JSON.stringify({
    //       speaker: req.params.speaker,
    //       translations,
    //     }),
    //   },
    //   function (error) {
    //     if (error) return console.log("error:", error);
    //   }
    // );
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
    const session = await vonage.video.createSession(sessionOptions);
    // save the sessionId
    app.set("sessionId", session.sessionId);
    await app.listen(port);
    console.log(`Example app listening at http://localhost:${port}`);

    // We will wait on starting the app until this is done
    // init();

  } catch(error) {
    console.error("Error creating session: ", error);
  }

}

init();
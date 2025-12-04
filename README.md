# Live Translations in video calls with Audio Connector

This is a demo application that allows for real-time translations feature in a video call with implemented with the Vonage [Audio Connector](https://developer.vonage.com/en/video/guides/audio-connector) and Microsoft Azure [AI Speech Service](https://azure.microsoft.com/en-us/products/ai-services/speech-translation).

There is a companion [blog post](https://developer.vonage.com/en/blog/video-ai-live-translations-with-audio-connector) that you can read to learn more about the application works.

This demo is more of a showcase of a feature that can be created using the Vonage Audio Connector. It is not necessarily production ready.

## Credentials

To get be able to run the demo, you will need to rename `.envcopy` to `.env` and fill in all the fields.

The Application ID and Private Key can be found in [Vonage dashboard]([http://dashboard.vonage.com/](https://dashboard.vonage.com/applications)) under the Application you created.
>Note: The Private Key downloaded from the application in the dashboard will need to be Base64 converted. I made a [Base64 encoder tool](https://mylight.work/private-key-to-environment-variable) that runs completely in your browser and nothing is sent to a server.

`AZURE_SUBSCRIPTION_KEY` and `AZURE_SERVICE_REGION` can be found in this [dashboard](https://portal.azure.com/).

## Running the application

### On the Web

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/Vonage-Community/demo-video-node-audio_connector-live_translations/tree/main)

This is the quickest way to get up and running. There is a script that will walk you through setting up an application and get the application running.

### Locally

- Clone this repo.
- `npm install` the dependencies
- fill in the credentials in the .env
- this application uses a WebSocket Server that is publically available on the internet. A tool like [ngrok](https://ngrok.com/) or [localtunnel](https://github.com/localtunnel/localtunnel) can be used to accomplish this. Some modification to the code may need to be done.

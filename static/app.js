/* global OT */

const login = document.querySelector("#login");
const appContainer = document.querySelector("#app-container");
const translationsContainer = document.querySelector("#translations-container");
const translationsFeed = document.querySelector("#translations-feed");
const closeButton = document.querySelector("#close");
const nameInput = document.querySelector("#name");
const enterBtn = document.querySelector("#enter-button");
const spokenSelect = document.querySelector("#spoken-select");
const targetSelect = document.querySelector("#target-select");
const leaveBtn = document.querySelector("#leave-button");
const translateBtn = document.querySelector("#translate-button");

const voiceSelect = document.querySelector("#voice-select");
const toggleTranslatedTextBtn = document.querySelector("#toggle-translated-text-button");
const toggleTranslatedAudioBtn = document.querySelector("#toggle-translated-audio-button");

// setting up speech synthesis
const synth = window.speechSynthesis;
let allVoices = [];
let filteredVoices = [];
synth.addEventListener("voiceschanged", () => {
  console.log("voiceschanged");
  allVoices = synth.getVoices()
  console.log("voices: ", allVoices);
});

// let apiKey;
let applicationId;
let sessionId;
let token;
let session;
let streamId;
let connectionId;
let socketConnectionId;

let isTranslating = false;

let showTranslations = false;

let sayTranslation = false;

function handleError(error) {
  if (error) {
    console.error(error);
    alert(error);
  }
}

function updateVoiceList() {
  const selectedTarget = targetSelect.value.split("-")[0];
  filteredVoices = allVoices.filter(voice => voice.lang.includes(selectedTarget));
  if (filteredVoices.length === 0) {
    filteredVoices = allVoices.filter(voice => voice.lang.includes("en"));
  }
  console.log("filteredVoices: ", filteredVoices);
  for (let i = 0; i < filteredVoices.length; i++) {
    const option = document.createElement("option");
    option.textContent = `${filteredVoices[i].name}`;
    option.setAttribute("data-lang", filteredVoices[i].lang);
    option.setAttribute("data-name", filteredVoices[i].name);
    voiceSelect.appendChild(option);
  }
}

function translationStarted() {
  translateBtn.textContent = "Stop Translation";
  isTranslating = true;
  translateBtn.disabled = false;
  toggleTranslatedAudioBtn.disabled = false;
  toggleTranslatedTextBtn.disabled = false;
  // voiceSelect.disabled = false;
}

function translationStopped() {
  translateBtn.textContent = "Start Translation";
  isTranslating = false;
  toggleTranslatedAudioBtn.disabled = true;
  toggleTranslatedTextBtn.disabled = true;
  voiceSelect.disabled = true;
  synth.cancel();
}


// Connect to Audio Connector
function connectToAudioConnector() {
  // Implement WebSocket connection logic here if needed
  fetch("/connect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sessionId,
      connectionId,
      streamId,
      speaker: nameInput.value,
      spoken: spokenSelect.value,
      target: targetSelect.value,
    }),
  })
  .then((response) => response.json())
  .then((socketData) => {
    console.log({ socketData });
    socketConnectionId = socketData.connectionId;
    translationStarted();
    // translateBtn.disabled = false;
    // toggleTranslatedTextBtn.disabled = false;
    // toggleTranslatedAudioBtn.disabled = false;
    return;
  });

}



function initializeSession() {
  console.log("initializeSession");
  updateVoiceList();
  // session = OT.initSession(apiKey, sessionId);
  session = OT.initSession(applicationId, sessionId);

  // Subscribe to a newly created stream
  session.on("streamCreated", (event) => {
    const subscriberOptions = {
      insertMode: "append",
      width: "360px",
      height: "240px",
    };
    const subscriber = session.subscribe(
      event.stream,
      "subscribers",
      subscriberOptions,
      handleError
    );
  });

  session.on("sessionDisconnected", (event) => {
    console.log("You were disconnected from the session.", event.reason);
  });

  session.on("signal:translation", (event) => {
      const signalData = JSON.parse(event.data);
      if (signalData.translations[targetSelect.value] !== undefined) {
        if (showTranslations) {

          translationsFeed.innerHTML += `
          <div class="translation">
            <div class="speaker">${signalData.speaker}: &nbsp;&nbsp;</div>
            <div class="text">${signalData.translations[targetSelect.value]}</div>
          </div>`;
          const isFeedAtBottom =
            translationsFeed.offsetHeight + translationsFeed.scrollTop ===
            translationsFeed.scrollHeight;
          if (isFeedAtBottom) {
            const translationElems = document.querySelectorAll(".translation");
            console.log("translationElems.length: ", translationElems.length);
            translationElems[translationElems.length - 1].scrollIntoView();
          }
        }
        // say translation
        if (sayTranslation) {
          const utterance = new SpeechSynthesisUtterance(signalData.translations[targetSelect.value]);
          const selectedVoice = voiceSelect.selectedOptions[0];
          console.log("selectedVoice: ", selectedVoice);
          if (selectedVoice) {
            utterance.voice = filteredVoices.find(voice => voice.name === selectedVoice.dataset.name);
          }
          synth.speak(utterance);
        }
      }
    
  });


  // Connect to the session
  session.connect(token, (error) => {
    if (error) {
      console.log("session.connect error", session);
      handleError(error);
    } else {
      login.style.display = "none";
      appContainer.style.display = "block";
      // If the connection is successful, publish the publisher to the session
      // initialize the publisher
      const publisherOptions = {
        insertMode: "append",
        width: "360px",
        height: "240px",
        name: nameInput.value,
      };
      const publisher = OT.initPublisher(
        "publisher",
        publisherOptions,
        (error) => {
          if (error) {
            console.log("publisher error");
            handleError(error);
          } else {
            console.log("publisher good to go!");
            console.log("publisher: ", publisher);
            streamId = publisher.streamId;
            connectionId = publisher.session.connection.connectionId;
            console.log("streamId: ", streamId);
            console.log("connectionId: ", connectionId);
          }
        }
      );

      session.publish(publisher, (error) => {
        if (error) {
          handleError(error);
        } else {
          connectToAudioConnector();
          // publishing to session, now create Audio Connector WebSocket connection!
          // fetch("/connect", {
          //   method: "POST",
          //   headers: {
          //     "Content-Type": "application/json",
          //   },
          //   body: JSON.stringify({
          //     sessionId,
          //     connectionId,
          //     streamId,
          //     speaker: nameInput.value,
          //     spoken: spokenSelect.value,
          //     target: targetSelect.value,
          //   }),
          // })
          // .then((response) => response.json())
          // .then((socketData) => {
          //   console.log({ socketData });
          //   socketConnectionId = socketData.connectionId;
          //   translateBtn.disabled = false;
          //   toggleTranslatedTextBtn.disabled = false;
          //   toggleTranslatedAudioBtn.disabled = false;
          // });
        }
      });
    }
  });


  function closeSession() {
    session.disconnect();
    appContainer.style.display = "none";
    nameInput.value = "";
    login.style.display = "flex";
    translateBtn.disabled = true;
    toggleTranslatedAudioBtn.disabled = true;
    toggleTranslatedTextBtn.disabled = true;
    translationsFeed.innerHTML = "";
    translationsContainer.style.display = "none";
    showTranslations = false;
    isTranslating = false;
    sayTranslation = false;
    translateBtn.textContent = "Start Translation";
    toggleTranslatedAudioBtn.textContent = "Start Translated Audio";
    toggleTranslatedTextBtn.textContent = "Start Translated Text";
    synth.cancel();
  }

  leaveBtn.addEventListener("click", () => {
    if (isTranslating){
      fetch(`/disconnect/${socketConnectionId}`)
        .then((response) => response.json())
        .then((disconnectData) => {
          console.log({ disconnectData });
          closeSession();
        });
      
    } else {
      closeSession();
    }
  });
}

enterBtn.addEventListener("click", () => {
  // Make a GET request to get the OpenTok API key, session ID, and token from the server
  fetch("/session")
    .then((response) => response.json())
    .then((sessionData) => {
      // apiKey = sessionData.apiKey;
      applicationId = sessionData.applicationId;
      sessionId = sessionData.sessionId;
      token = sessionData.token;
      // Initialize a Vonage Video Session object
      initializeSession();
    });
});


translateBtn.addEventListener("click", () => {
  if (!isTranslating) {
    // Make a POST request to get the Vonage Application ID, session ID, and token from the server
    fetch("/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId,
        connectionId,
        speaker: nameInput.value,
        spoken: spokenSelect.value,
        target: targetSelect.value,
      }),
    })
    .then((response) => response.json())
    .then((translateData) => {
      console.log({ translateData });
      // translationsContainer.style.display = "block";
      // showTranslations = true;
      // translateBtn.disabled = true;
      connectToAudioConnector();
      translationStarted();
    });
  } else {
    fetch(`/disconnect/${socketConnectionId}`)
    .then((response) => response.json())
    .then((disconnectData) => {
      console.log({ disconnectData });
      translationStopped();
      // isTranslating = false;
      // translateBtn.textContent = "Start Translation";
      // synth.cancel();
    });

  }
});

toggleTranslatedTextBtn.addEventListener("click", () => {
  showTranslations = !showTranslations;
  translationsContainer.style.display = showTranslations ? "block" : "none";
  toggleTranslatedTextBtn.textContent = showTranslations ? "Hide Translated Text" : "Show Translated Text";
  // translateBtn.disabled = !showTranslations;
  // if (!showTranslations) {
  //   translationsFeed.innerHTML = "";
  // }
  // translationsContainer.style.display = "none";
  // showTranslations = false;
  // translateBtn.disabled = false;
});

// closeButton.addEventListener("click", () => {
//   translationsContainer.style.display = "none";
//   showTranslations = false;
//   // translateBtn.disabled = false;
// });

toggleTranslatedAudioBtn.addEventListener("click", () => {
  sayTranslation = !sayTranslation;
  document.querySelectorAll('video').forEach(video => video.volume = sayTranslation ? 0.5 : 1);
  // document.querySelectorAll('video').forEach(video => video.muted = sayTranslation);
  toggleTranslatedAudioBtn.textContent = sayTranslation ? "Stop Translated Audio" : "Start Translated Audio";
  voiceSelect.disabled = !sayTranslation;
});

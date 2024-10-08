<template>
  <div class="app-container">
    <div class="game-container">
      <div :class="{'flash-red': timerEnded && !submittedFile}" class="top-section">
        <h2>GAME TIME</h2>
        <h2> TURN: {{ turnNumber }}/{{ lobbyMembers.length }}</h2>
        <Timer class="timer" ref="timerRef" :running="turnRunning" :turnLength="turnLength" @endTimer="endTimer"/>
        <div class="lobby-code">
          <h3>Connected to lobby with code: {{ lobbyCode }}</h3>
        </div>
      </div>

      <div class="main-content">
        <div class="lobby-container">
          <h3>Lobby Member List</h3>
          <ul>
            <li v-for="member in lobbyMembers" :key="member.name" class="lobby-member">
              {{ member.name }}
              <span v-if="member.submittedFile" class="check-mark">✔️</span>
              <span v-if="member.name == lobbyHost" class="crown">👑</span>
            </li>
          </ul>

          <div class="chat-container">
            <Chat />
          </div>
        </div>

        <div class="audio-container">
          <div v-if="audioFiles.length > 0">
            <div v-for="file in audioFiles" :key="file" class="audio-file">
              <label>{{ getDirectoryAboveFilename(file) }}</label><br>
              <audio :src="file" controls></audio>
              <a :href="file" :download="getFilename(file)" target="_blank" class="download-button">Download</a>
            </div>
          </div>

          <div v-if="finalAudioFiles.length > 0" class="audio-container">
            <div v-for="(finalSong, songIndex) in finalAudioFiles" :key="songIndex" class="audio-column">
              <label>{{ getDirectoryAboveFilename(finalSong[0]) }}</label><br>
              <div v-for="(file, fileIndex) in finalSong" :key="songIndex + '-' + fileIndex" class="audio-file">
                <br><br>
                <audio :src="file" controls></audio>
                <a :href="file" :download="getFilename(file)" target="_blank" class="download-button">Download</a>
              </div>
            </div> 
          </div>
        </div>
        
        <div class="userActions">
        <div class="upload-container">
          <div 
            class="drag-drop-area"
            @dragover.prevent="handleDragOver"
            @dragenter.prevent="draggingFile = true"
            @dragleave="draggingFile = false"
            @drop.prevent="handleFileDrop"
            :class="{'dragging': draggingFile}"
          >
            <p v-if="!selectedFile">Drag and drop your mp3 here</p>
            <p v-if="selectedFile">{{ selectedFile.name }}</p>
          </div>
          <button @click="uploadFile" :disabled="!selectedFile || submittedFile">Upload</button>
          <p v-if="uploadMessage">{{ uploadMessage }}</p>
        </div>
      
          <div class="start-button" v-if="isHost && gameRunning && turnEnded">
            <button @click="onClickStart" type="button" class="button">start turn {{ turnNumber + 1 }}</button><br>
          </div>
          <div class="start-button" v-if="isHost && !gameRunning">
            <button @click="onClickNewGame" type="button" class="button">new game</button><br>
          </div>
          <button class="button" type="button" @click="onClickSaveFiles" :disabled="!(turnNumber >= lobbyMembers.length && turnEnded)">
            save 
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
  import { defineComponent, inject, ref, computed } from 'vue';
  import { WebSocketState } from '../websocket';
  import { onBeforeRouteLeave } from 'vue-router';
  import { nextTick } from 'vue';
  import Timer from './Timer.vue'
  import Chat from './Chat.vue'

  export default defineComponent({
  inject: ['websocketState'], 
  name: 'GamePage',
  components: {
    Timer,
    Chat
  },
  data() {
    return {
      selectedFile: null,
      submittedFile: false,
      uploadMessage: '',
      gameRunning: false,
      turnRunning: false,
      turnLength: 0,
      timerEnded: false,
      isHost: false,
      audioFiles: [] as string[],
      draggingFile: false,
    };
  },
  methods: {
    onClickSaveFiles() {
        const message = {
          type: "save_files"
        }
        console.log("sending save files")
        this.sendMessage(JSON.stringify(message));
    },
    handleDragOver(event) {
    // Prevent the default action (open as a URL)
    event.preventDefault();
    },
    handleFileDrop(event) {
      this.draggingFile = false;
      const files = event.dataTransfer.files;
      if (files.length > 0) {
        this.selectedFile = files[0];
      }
    },
    handleFileUpload(event) {
      this.selectedFile = event.target.files[0];
    },
    async uploadFile() {
      if (!this.selectedFile) {
        this.uploadMessage = "please select a file!";
        return;
      } else if (!this.turnRunning && !this.turnEnded) {
        this.uploadMessage = "watchu uploading for boi?";
        return;
      }

      const formData = new FormData();
      formData.append('file', this.selectedFile);

      try {
        const response = await fetch('/upload', {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          this.uploadMessage = "file uploaded successfully!";
        } else {
          const errorMessage = await response.text();
          this.uploadMessage = errorMessage;
        }
      } catch (error) {
        console.error('Error uploading file:', error);
        this.uploadMessage = "an error occurred during file upload.";
      }
    },
    onClickStart(){
      const msg = {
        type: 'game_start_request'
      }
      this.sendMessage(JSON.stringify(msg));
    },
    onClickNewGame() {
      const msg = {
        type: 'new_game_request'
      }
      this.sendMessage(JSON.stringify(msg));
    },
    endTimer(){
      this.timerEnded = true;
      this.turnRunning = false;
    },
    getDirectoryAboveFilename(filePath: string) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const parts = normalizedPath.split('/');
      return parts.length > 1 ? parts[parts.length - 2] : '';
    },
    getFilename(filePath: string) {
      const normalizedPath = filePath.replace(/\\/g, '/');
      const parts = normalizedPath.split('/');
      return parts.length > 1 ? parts[parts.length - 1] : '';
    }
  },
  setup() {
    const websocketState = inject<WebSocketState>('websocketState');
    const sendMessage = inject<(message: string) => void>('sendMessage');
    const resetWebsocketState = inject<() => void>('resetWebsocketState');

    if (!websocketState || !sendMessage || !resetWebsocketState) {
      throw new Error('WebSocket state function not provided');
    }

    const isHost = computed(() => websocketState.lobbyHost === websocketState.name);
    const lobbyHost = computed(() => websocketState.lobbyHost);
    const lobbyMembers = computed(() => websocketState.lobbyMembers);
    const submittedFile = computed(() => websocketState.submittedFile);
    const lobbyCode = computed(() => websocketState.lobbyCode);
    const gameRunning = computed(() => websocketState.gameRunning);
    const turnRunning = computed(() => websocketState.turnRunning);
    const turnLength= computed(() => websocketState.turnLength);
    const turnEnded = computed(() => websocketState.turnEnded);
    const timerEnded = computed(() => websocketState.timerEnded);
    const turnNumber = computed(() => websocketState.turnNumber);
    const username = computed(() => websocketState.name);

    const audioFiles = ref<string[]>([]);

    const finalAudioFiles = ref<string[][]>([]);

    // Establish WebSocket connection and event listener
    const socket = websocketState.socket;

    if (!socket ) {
      throw new Error('socket not provided');
    }

    socket.addEventListener('message', (event: MessageEvent) => {
    const messageObj = JSON.parse(event.data);

    if (messageObj.type === 'audio_files' && Array.isArray(messageObj.filenames)) {
        console.log("Received audio files from server:", messageObj.filenames);
        audioFiles.value = messageObj.filenames;
        finalAudioFiles.value = [];
    }

    if (messageObj.type === 'final_audio_files' && Array.isArray(messageObj.filenames)) {
        console.log("Received final audio files from server:", messageObj.filenames);
        audioFiles.value = [];
        finalAudioFiles.value = messageObj.filenames.filter(fileArray => Array.isArray(fileArray) && fileArray.length > 0);
    }
  });
   onBeforeRouteLeave((to, from, next) => {
     const msg = {
       type: 'leave_lobby',
     };
     sendMessage(JSON.stringify(msg));
     resetWebsocketState();

     next();
   });

    return {
      audioFiles,
      finalAudioFiles,
      lobbyHost,
      lobbyMembers,
      lobbyCode,
      isHost,
      username,
      submittedFile,
      gameRunning,
      turnRunning,
      turnLength,
      turnEnded,
      timerEnded,
      turnNumber,
      sendMessage,
      resetWebsocketState,
    };
  },
  watch: {
    timerEnded(oldVal, newVal) {
        if (newVal && this.$refs.timerRef) {
          this.$refs.timerRef.stopT();
        }
      }
    },
    turnEnded(oldVal, newVal) {
      if (newVal) {
        this.selectedFile = null;
      }
    },
});
</script>

<style scoped>
.upload-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 10px;
}

.drag-drop-area {
  width: 100%;
  height: 150px;
  border: 2px dashed #7e57c2; /* Purple border */
  background-color: #1c1c1c; /* Black background */
  color: white;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 10px;
  transition: border-color 0.3s ease;
  border-radius: 8px;
}

.drag-drop-area.dragging {
  border-color: #9c27b0; /* Lighter purple when dragging */
}

button {
  background-color: #7e57c2; /* Purple button */
  color: white;
  border: none;
  padding: 10px 20px;
  font-size: 14px;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

button:hover:enabled {
  background-color: #9c27b0; /* Lighter purple on hover */
}

.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}

.app-container {
  height: 100vh;
  margin: 0;
  overflow: hidden; /* Prevent scrolling */
}

.game-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0; /* Remove default padding */
  box-sizing: border-box;
}

.top-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 40px;
  margin-bottom: 5px;
  padding: 5px; /* Small padding for spacing */
}

.lobby-code {
  margin-left: 10px;
}

.main-content {
  display: flex;
  flex-direction: row; /* Stack elements horizontally */
  gap: 10px; /* Increased gap between containers */
  padding: 5px; /* Small padding for spacing */
}

.lobby-container,
.chat-container {
  flex: 1; /* Make all containers take equal space */
  padding: 10px; /* Added padding for internal spacing */
  box-sizing: border-box;
  border: 1px solid #ccc; /* Border for visual separation */
  border-radius: 5px; /* Rounded corners */
  max-height: calc(100vh - 100px); /* Adjust height to prevent overflow */
  border: 1px solid #ccc;
  border-radius: 5px;
  overflow: hidden;
}
.audio-container {
  display: flex;
  gap: 20px; /* Space between columns */
}

.audio-column {
  display: flex;
  flex-direction: column;
  gap: 10px; /* Space between audio files within a column */
}

.audio-file {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.download-button {
  display: inline-block;
  width: 24px; /* Small square button */
  height: 24px;
  background-color: #6200ea; /* Purple button */
  color: #fff;
  text-align: center;
  line-height: 24px;
}

.lobby-container {
  flex: 1; /* Adjust flex to fit in the vertical stack */
  padding: 5px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 5px;
  text-align: left;
  margin-bottom: 5px; /* Add some space below the lobby container */
}

.lobby-container h3 {
  margin-bottom: 5px;
}

.lobby-member {
  list-style: none;
  padding: 5px 0;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.check-mark, .crown {
  margin-left: 10px;
}

.lobby-member:last-child {
  border-bottom: none;
}
.userActions {
  display: flex;
  flex-direction: column; /* Stack user actions vertically */
  padding: 5px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 5px;
}

button {
  background-color: purple;
  color: white;
  border: none;
  padding: 10px 20px;
  cursor: pointer;
  margin-top: 10px;
}

button:disabled {
  background-color: grey;
  color: #ccc;
  cursor: not-allowed;
}

button:hover:not(:disabled) {
  background-color: #6a0dad;
}

.save-button {
  background-color: purple;
  color: white;
  padding: 10px 20px;
}

input[type="file"] {
  margin-bottom: 5px;
}
</style>

<style>
/* Global Styles */
html, body {
  height: 100%;
  margin: 0;
  overflow: hidden; /* Prevent scrolling on the page */
  font-family: Arial, sans-serif;
  box-sizing: border-box;
}

body {
  padding: 0;
}

.flash-red {
  animation: flash-red 1s infinite;
}

.audio-container {
  padding: 10px; /* Add some padding for spacing */
  border: 1px solid #ccc; /* Add a border */
  border-radius: 5px; /* Rounded corners for the box */
  margin-bottom: 5px; /* Space below the audio container */
}

.audio-file {
  margin-bottom: 15px; /* Add some space between audio files */
  display: flex;
  align-items: center;
}

label {
  font-weight: bold;
  margin-bottom: 5px;
  display: block;
}

.download-button {
  margin-left: 10px; /* Space between audio player and download button */
  text-decoration: none;
  color: #007bff;
  font-size: 14px;
}

.download-button:hover {
  text-decoration: underline;
}

@keyframes flash-red {
  0% {
    background-color: white;
  }
  50% {
    background-color: red;
  }
  100% {
    background-color: white;
  }
}
</style>
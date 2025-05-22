// DOM Elements
const sourceUploadRadio = document.getElementById('sourceUpload'); // New
const sourceRecordRadio = document.getElementById('sourceRecord');
const uploadOptionsContainer = document.getElementById('uploadOptionsContainer'); // New
const recordOptionsContainer = document.getElementById('recordOptionsContainer');
const uploadSoundInput = document.getElementById('uploadSoundInput'); // New
const uploadedFileName = document.getElementById('uploadedFileName'); // New
const recordButton = document.getElementById('recordButton');
const playArpeggioButton = document.getElementById('playArpeggioButton');
const statusEl = document.getElementById('status');

// Global State
let audioContext;
let currentSourceMode = 'upload'; // 'upload' or 'record'
let uploadedAudioBuffer; // New
let recordedAudioBuffer;
let mediaRecorder;
let recordedChunks = [];

// Initialization
function init() {
  setupEventListeners();
  updateSourceModeUI(); // Set initial UI state
}

function updateSourceModeUI() {
  if (currentSourceMode === 'upload') {
    uploadOptionsContainer.style.display = 'block';
    recordOptionsContainer.style.display = 'none';
  } else { // 'record'
    uploadOptionsContainer.style.display = 'none';
    recordOptionsContainer.style.display = 'block';
  }
}

function setupEventListeners() {
  sourceUploadRadio.addEventListener('change', () => { // New
    currentSourceMode = 'upload';
    updateSourceModeUI();
    statusEl.textContent = 'Source: Uploaded File';
  });

  sourceRecordRadio.addEventListener('change', () => {
    currentSourceMode = 'record';
    updateSourceModeUI();
    statusEl.textContent = 'Source: Last Recorded Sound';
  });

  uploadSoundInput.addEventListener('change', async (event) => { // New
    const file = event.target.files[0];
    uploadedFileName.textContent = '';
    if (!file) {
      uploadedAudioBuffer = null;
      statusEl.textContent = 'File selection cancelled.';
      return;
    }

    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    statusEl.textContent = `Loading ${file.name}...`;
    try {
      const arrayBuffer = await file.arrayBuffer();
      uploadedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      statusEl.textContent = `File loaded: ${file.name}`;
      uploadedFileName.textContent = `Selected: ${file.name}`;
    } catch (error) {
      console.error("Error processing uploaded file:", error);
      statusEl.textContent = 'Error processing audio file. Please try a different file.';
      uploadedAudioBuffer = null;
    }
  });

  recordButton.addEventListener('click', async () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recordButton.textContent = 'Record';
      statusEl.textContent = 'Processing recording...';
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          const blob = new Blob(recordedChunks, { type: 'audio/webm' }); // Specify MIME type
          const arrayBuffer = await blob.arrayBuffer();
          try {
            recordedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            statusEl.textContent = 'Recording ready!';
            // Enable play button or indicate readiness
          } catch (decodeError) {
            console.error("Error decoding audio data:", decodeError);
            statusEl.textContent = 'Error decoding audio. Please try again.';
          }
        };
        mediaRecorder.start();
        recordButton.textContent = 'Stop Recording';
        statusEl.textContent = 'Recording...';
        recordedAudioBuffer = null; // Clear previous recording
      } catch (err) {
        console.error("Error accessing microphone:", err);
        statusEl.textContent = 'Error accessing microphone. Please allow permission.';
      }
    }
  });

  playArpeggioButton.addEventListener('click', async () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    statusEl.textContent = 'Playing arpeggio...';

    if (currentSourceMode === 'upload') {
      if (!uploadedAudioBuffer) {
        statusEl.textContent = 'Error: No audio file uploaded or processed.';
        console.error('No uploaded audio buffer available.');
        return;
      }
      playArpeggio(uploadedAudioBuffer);
    } else if (currentSourceMode === 'record') {
      if (!recordedAudioBuffer) {
        statusEl.textContent = 'Error: No recorded audio available or recording not processed.';
        console.error('No recorded audio available.');
        return;
      }
      playArpeggio(recordedAudioBuffer);
    }
  });
}


function playArpeggio(bufferToPlay) {
  if (!bufferToPlay) {
    statusEl.textContent = 'Error: No audio buffer to play.';
    console.error('playArpeggio called with no buffer.');
    return;
  }
  const chordType = document.getElementById('chord').value;
  const octaves = parseInt(document.getElementById('octaves').value, 10);
  const pattern = document.getElementById('pattern').value;
  const tempo = parseInt(document.getElementById('tempo').value, 10);

  const intervals = getIntervals(chordType);
  let sequence = [];
  for (let o = 0; o < octaves; o++) {
    for (let i = 0; i < intervals.length; i++) {
      sequence.push(intervals[i] + 12 * o);
    }
  }
  if (pattern === 'down') {
    sequence.reverse();
  } else if (pattern === 'updown') {
    const downSequence = [...sequence].reverse();
    // Avoid duplicating the peak/nadir note if sequence length > 1
    sequence = sequence.concat(downSequence.slice(1));
  }


  const noteDuration = 60 / tempo; // seconds per beat
  let startTime = audioContext.currentTime;

  sequence.forEach((semitones, index) => {
    const source = audioContext.createBufferSource();
    source.buffer = bufferToPlay;
    source.playbackRate.value = Math.pow(2, semitones / 12);
    source.connect(audioContext.destination);
    source.start(startTime + noteDuration * index);
  });
  // Optional: Update status when playback finishes (can be complex with multiple sources)
  // setTimeout(() => statusEl.textContent = 'Playback finished.', sequence.length * noteDuration * 1000);
}

function getIntervals(type) {
  switch (type) {
    case 'major':
      return [0, 4, 7]; // Root, Major Third, Perfect Fifth
    case 'minor':
      return [0, 3, 7]; // Root, Minor Third, Perfect Fifth
    case 'diminished':
      return [0, 3, 6]; // Root, Minor Third, Diminished Fifth
    case 'augmented':
      return [0, 4, 8]; // Root, Major Third, Augmented Fifth
    default:
      console.warn(`Unknown chord type: ${type}, defaulting to major.`);
      return [0, 4, 7];
  }
}

// Call init on script load
document.addEventListener('DOMContentLoaded', init);

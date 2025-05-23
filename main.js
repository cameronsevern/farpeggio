// DOM Elements
const uploadSoundInput = document.getElementById('uploadSoundInput');
const uploadedFileName = document.getElementById('uploadedFileName');
const recordButton = document.getElementById('record-button'); // Corrected ID
const playArpeggioButton = document.getElementById('play-button'); // Corrected ID
const uploadButton = document.getElementById('upload-button'); // Added upload button
const statusEl = document.getElementById('status');

// Global State
let audioContext;
let lastInteractedSource = 'none'; // 'upload', 'record', or 'none'
let uploadedAudioBuffer;
let recordedAudioBuffer;
let mediaRecorder;
let recordedChunks = [];
const DEFAULT_SOUND_URL = 'sounds/splat.wav';
let defaultAudioBuffer;

// Initialization
function init() {
  setupEventListeners();
  loadDefaultSound();
}

async function loadDefaultSound() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  try {
    const response = await fetch(DEFAULT_SOUND_URL);
    const arrayBuffer = await response.arrayBuffer();
    defaultAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log('Default sound loaded successfully.');
  } catch (error) {
    console.error('Failed to load default sound:', error);
    statusEl.textContent = 'Error loading default sound.';
  }
}

function setupEventListeners() {
  uploadButton.addEventListener('click', () => {
    uploadSoundInput.click(); // Trigger file input click
  });

  uploadSoundInput.addEventListener('change', async (event) => {
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
      lastInteractedSource = 'upload'; // Set last interacted source
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
      recordButton.innerHTML = '●'; // Change back to record symbol
      statusEl.textContent = 'Processing recording...';
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
        mediaRecorder.onstop = async () => {
          const blob = new Blob(recordedChunks, { type: 'audio/webm' });
          const arrayBuffer = await blob.arrayBuffer();
          try {
            recordedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            statusEl.textContent = 'Recording ready!';
            lastInteractedSource = 'record'; // Set last interacted source
          } catch (decodeError) {
            console.error("Error decoding audio data:", decodeError);
            statusEl.textContent = 'Error decoding audio. Please try again.';
          }
        };
        mediaRecorder.start();
        recordButton.innerHTML = '■'; // Change to stop symbol or text
        statusEl.textContent = 'Recording...';
        recordedAudioBuffer = null;
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

    let bufferToPlay = null;

    if (lastInteractedSource === 'upload') {
      if (uploadedAudioBuffer) {
        bufferToPlay = uploadedAudioBuffer;
      } else if (defaultAudioBuffer) {
        statusEl.textContent = 'No uploaded file. Using default sound.';
        bufferToPlay = defaultAudioBuffer;
      } else {
        statusEl.textContent = 'Error: No audio file uploaded and default sound not available.';
        console.error('No uploaded audio buffer available and default sound failed to load.');
        return;
      }
    } else if (lastInteractedSource === 'record') {
      if (recordedAudioBuffer) {
        bufferToPlay = recordedAudioBuffer;
      } else if (defaultAudioBuffer) {
        statusEl.textContent = 'No recorded sound. Using default sound.';
        bufferToPlay = defaultAudioBuffer;
      } else {
        statusEl.textContent = 'Error: No recorded audio available and default sound not available.';
        console.error('No recorded audio available and default sound failed to load.');
        return;
      }
    } else { // 'none' or unhandled
        if (defaultAudioBuffer) {
            statusEl.textContent = 'No sound selected. Using default sound.';
            bufferToPlay = defaultAudioBuffer;
        } else {
            statusEl.textContent = 'Error: No sound source selected and default sound not available.';
            console.error('No sound source selected and default sound failed to load.');
            return;
        }
    }

    if (bufferToPlay) {
      playArpeggio(bufferToPlay);
    }
    // If bufferToPlay is still null here, it means an error message was already set.
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

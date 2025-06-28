// farpeggio - Turn any sound into an arpeggio
// 
// iOS Safari Compatibility Notes:
// - AudioContext is created lazily after first user interaction
// - This prevents iOS Safari from blocking audio due to autoplay policies
// - All audio operations ensure AudioContext is properly initialized and resumed

// DOM Elements
const uploadSoundInput = document.getElementById('uploadSoundInput');
const uploadedFileName = document.getElementById('uploadedFileName');
const recordButton = document.getElementById('record-button');
const playArpeggioButton = document.getElementById('play-button');
const uploadButton = document.getElementById('upload-button');
const statusEl = document.getElementById('status');

// Global State
let audioContext;
let lastInteractedSource = 'none'; // 'upload', 'record', or 'none'
let uploadedAudioBuffer;
let recordedAudioBuffer;
let mediaRecorder;
let recordedChunks = [];
const DEFAULT_SOUND_URL = 'sounds/splat.mp3';
let defaultAudioBuffer = null; // Will store the decoded AudioBuffer
let defaultSoundArrayBufferPromise = null; // Promise for the fetched ArrayBuffer

// Initialization
function init() {
  // Do NOT initialize AudioContext early for iOS Safari compatibility
  // AudioContext will be created lazily on first user interaction
  audioContext = null;
  // Start fetching the default sound's ArrayBuffer immediately
  defaultSoundArrayBufferPromise = fetchDefaultSoundArrayBuffer();
  setupEventListeners();
}

// Helper function to ensure AudioContext is properly initialized
async function ensureAudioContext() {
  if (!audioContext) {
    // Create AudioContext only after user interaction for iOS Safari compatibility
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('AudioContext created after user interaction.');
  }
  
  if (audioContext.state === 'suspended') {
    try {
      await audioContext.resume();
      console.log('AudioContext resumed successfully.');
    } catch (err) {
      console.error('Failed to resume AudioContext:', err);
      throw new Error('Failed to activate audio system');
    }
  }
  
  return audioContext;
}

async function fetchDefaultSoundArrayBuffer() {
  try {
    const response = await fetch(DEFAULT_SOUND_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} for ${DEFAULT_SOUND_URL}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    console.log('Default sound ArrayBuffer fetched successfully.');
    return arrayBuffer;
  } catch (error) {
    console.error('Failed to fetch default sound ArrayBuffer:', error);
    statusEl.textContent = 'Error loading default sound data.';
    // Propagate the error so the play button remains disabled
    throw error;
  }
}

function setupEventListeners() {
  playArpeggioButton.disabled = true; // Disable play button initially

  if (defaultSoundArrayBufferPromise) {
    defaultSoundArrayBufferPromise
      .then(() => {
        playArpeggioButton.disabled = false;
        console.log('Default sound data ready, play button enabled.');
        // statusEl.textContent = 'Ready to play default sound.'; // Optional: can be set here
      })
      .catch(() => {
        playArpeggioButton.disabled = true; // Ensure it stays disabled on error
        statusEl.textContent = 'Failed to load default sound. Play button disabled.';
        console.error('Default sound data failed to load, play button remains disabled.');
      });
  } else {
    // This case should not be reached if init() runs correctly
    playArpeggioButton.disabled = true;
    statusEl.textContent = 'Critical error: Default sound system not initialized.';
    console.error('defaultSoundArrayBufferPromise was not set up.');
  }

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

    try {
      await ensureAudioContext(); // Use helper function for iOS compatibility
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
      statusEl.textContent = 'Error: Audio system not available. Please try again.';
      return;
    }

    statusEl.textContent = `Loading ${file.name}...`;
    try {
      const arrayBuffer = await file.arrayBuffer();
      uploadedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      statusEl.textContent = `File loaded: ${file.name}`;
      uploadedFileName.textContent = `Selected: ${file.name}`;
      lastInteractedSource = 'upload';
    } catch (error) {
      console.error("Error processing uploaded file:", error);
      statusEl.textContent = 'Error processing audio file. Please try a different file.';
      uploadedAudioBuffer = null;
    }
  });

  recordButton.addEventListener('click', async () => {
    try {
      await ensureAudioContext(); // Use helper function for iOS compatibility
    } catch (error) {
      console.error('Failed to initialize audio system:', error);
      statusEl.textContent = 'Error: Audio system not available. Please try again.';
      return;
    }

    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      recordButton.innerHTML = '●';
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
            lastInteractedSource = 'record';
          } catch (decodeError) {
            console.error("Error decoding audio data:", decodeError);
            statusEl.textContent = 'Error decoding audio. Please try again.';
          }
        };
        mediaRecorder.start();
        recordButton.innerHTML = '■';
        statusEl.textContent = 'Recording...';
        recordedAudioBuffer = null;
      } catch (err) {
        console.error("Error accessing microphone:", err);
        statusEl.textContent = 'Error accessing microphone. Please allow permission.';
      }
    }
  });

  playArpeggioButton.addEventListener('click', playArpeggioClickHandler);
}

async function playArpeggioClickHandler() {
  // 1. Ensure AudioContext is initialized and resumed (iOS Safari compatible)
  try {
    await ensureAudioContext();
  } catch (error) {
    console.error('Failed to initialize audio system:', error);
    statusEl.textContent = 'Audio system not available. Please try again or refresh the page.';
    return;
  }

  // 2. Ensure default sound is decoded if it hasn't been already
  if (!defaultAudioBuffer) {
    if (!defaultSoundArrayBufferPromise) {
      statusEl.textContent = 'Error: Default sound system not initialized.';
      console.error('defaultSoundArrayBufferPromise is null during play click.');
      return;
    }
    try {
      statusEl.textContent = 'Preparing default sound...'; // Inform user
      const arrayBuffer = await defaultSoundArrayBufferPromise; // Get the fetched ArrayBuffer
      if (arrayBuffer) {
        defaultAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        console.log('Default sound decoded successfully on demand.');
      } else {
        // This case implies fetchDefaultSoundArrayBuffer resolved with null/undefined,
        // or the promise was somehow replaced. The .catch in setupEventListeners
        // should ideally handle fetch failures.
        statusEl.textContent = 'Error: Default sound data unavailable for decoding.';
        console.error('ArrayBuffer for default sound is null/undefined after promise resolution during play.');
        return;
      }
    } catch (error) {
      // This catch handles errors from 'await defaultSoundArrayBufferPromise' (if it rejects here)
      // or from 'decodeAudioData'.
      console.error('Failed to load or decode default sound on demand:', error);
      statusEl.textContent = 'Error preparing default sound.';
      playArpeggioButton.disabled = true; // Disable button as default sound failed critically
      return;
    }
  }

  // 3. Determine bufferToPlay
  let bufferToPlay = null;
  let soundSourceName = "";

  if (lastInteractedSource === 'upload') {
    if (uploadedAudioBuffer) {
      bufferToPlay = uploadedAudioBuffer;
      soundSourceName = "uploaded sound";
    } else if (defaultAudioBuffer) {
      bufferToPlay = defaultAudioBuffer;
      soundSourceName = "default sound (uploaded not ready)";
    } else {
      statusEl.textContent = 'Error: No sound available (upload failed, default failed).';
      return;
    }
  } else if (lastInteractedSource === 'record') {
    if (recordedAudioBuffer) {
      bufferToPlay = recordedAudioBuffer;
      soundSourceName = "recorded sound";
    } else if (defaultAudioBuffer) {
      bufferToPlay = defaultAudioBuffer;
      soundSourceName = "default sound (recording not ready)";
    } else {
      statusEl.textContent = 'Error: No sound available (record failed, default failed).';
      return;
    }
  } else { // 'none' - default sound is the primary option
    if (defaultAudioBuffer) {
      bufferToPlay = defaultAudioBuffer;
      soundSourceName = "default sound";
    } else {
      // This means defaultAudioBuffer is still null even after attempting to load/decode it.
      statusEl.textContent = 'Error: Default sound is not available.';
      console.error('Default sound buffer is null when it is the selected source.');
      return;
    }
  }

  // 4. Play Arpeggio
  if (bufferToPlay) {
    statusEl.textContent = `Playing arpeggio with ${soundSourceName}...`;
    playArpeggio(bufferToPlay);
  } else {
    // This state should ideally be prevented by the checks above.
    statusEl.textContent = 'Error: No audio buffer available to play.';
    console.error('bufferToPlay is null unexpectedly before calling playArpeggio.');
  }
}


function playArpeggio(bufferToPlay) {
  if (!bufferToPlay) {
    statusEl.textContent = 'Error: No audio buffer to play.';
    console.error('playArpeggio called with no buffer.');
    return;
  }
  
  // Additional iOS Safari compatibility check
  if (!audioContext || audioContext.state !== 'running') {
    statusEl.textContent = 'Error: Audio system not ready. Please try again.';
    console.error('AudioContext not running when trying to play arpeggio.');
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
    sequence = sequence.concat(downSequence.slice(1));
  }

  const noteDuration = 60 / tempo; // seconds per beat
  let startTime = audioContext.currentTime;

  try {
    sequence.forEach((semitones, index) => {
      const source = audioContext.createBufferSource();
      source.buffer = bufferToPlay;
      source.playbackRate.value = Math.pow(2, semitones / 12);
      source.connect(audioContext.destination);
      source.start(startTime + noteDuration * index);
    });
  } catch (error) {
    console.error('Error playing arpeggio:', error);
    statusEl.textContent = 'Error playing sound. Please try again.';
  }
}

function getIntervals(type) {
  switch (type) {
    case 'major':
      return [0, 4, 7];
    case 'minor':
      return [0, 3, 7];
    case 'diminished':
      return [0, 3, 6];
    case 'augmented':
      return [0, 4, 8];
    default:
      console.warn(`Unknown chord type: ${type}, defaulting to major.`);
      return [0, 4, 7];
  }
}

// Call init on script load
document.addEventListener('DOMContentLoaded', init);

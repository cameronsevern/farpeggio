let recordButton = document.getElementById('record');
let playButton = document.getElementById('play');
let statusEl = document.getElementById('status');

let audioContext;
let mediaRecorder;
let recordedChunks = [];
let audioBuffer;

recordButton.addEventListener('click', async () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    recordButton.textContent = 'Record';
    statusEl.textContent = 'Processing...';
  } else {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    recordedChunks = [];
    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunks);
      const arrayBuffer = await blob.arrayBuffer();
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      statusEl.textContent = 'Recording ready!';
      playButton.disabled = false;
    };
    mediaRecorder.start();
    recordButton.textContent = 'Stop';
    statusEl.textContent = 'Recording...';
  }
});

playButton.addEventListener('click', () => {
  if (!audioBuffer) return;

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
    const down = sequence.slice().reverse();
    sequence = sequence.concat(down.slice(1));
  }

  const noteDuration = 60 / tempo; // seconds per beat
  let startTime = audioContext.currentTime;

  sequence.forEach((semitones, index) => {
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = Math.pow(2, semitones / 12);
    source.connect(audioContext.destination);
    source.start(startTime + noteDuration * index);
  });
});

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
      return [0, 4, 7];
  }
}

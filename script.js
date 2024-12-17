var ctx = new (window.AudioContext || window.webkitAudioContext)();
var audioBuffer = null;
var source = null;
var isRecording = false;
var display = document.getElementById('display');
var titleInput = document.getElementById('titleInput');
var saveBtn = document.getElementById('saveBtn');
var newBtn = document.getElementById('newBtn');
var playBtn = document.getElementById('playBtn');
var list = document.getElementById('list');

// currentRecording will be an array of objects like:
// [{type:'on', duration:...}, {type:'off', duration:...}, {type:'on', duration:...}, ...]
var currentRecording = [];

// To track timing:
var lastEventTime = null;
var firstPressHappened = false; 
var lastEventWasOn = false;

fetch('vibration.mp3')
.then(response => response.arrayBuffer())
.then(data => ctx.decodeAudioData(data))
.then(buffer => {
  audioBuffer = buffer;
});

document.addEventListener('keydown', function(e) {
  if (e.code === 'Space') {
    if (!isRecording && audioBuffer) {
      isRecording = true;
      // If this is the first press in this recording, we start from here
      var now = Date.now();
      if (!firstPressHappened) {
        // Start timeline
        firstPressHappened = true;
        lastEventTime = now;
      } else {
        // If not the first press, we must have been waiting (off). Record the off interval.
        var offDuration = now - lastEventTime;
        currentRecording.push({type:'off', duration: offDuration});
      }
      
      // Start the on sound
      source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(ctx.destination);
      source.start();

      lastEventTime = Date.now();
      lastEventWasOn = true;
    }
  }
});

document.addEventListener('keyup', function(e) {
  if (e.code === 'Space' && isRecording) {
    // Space released, end the on interval
    var now = Date.now();
    var onDuration = now - lastEventTime;
    // Record this on interval
    currentRecording.push({type:'on', duration: onDuration});
    isRecording = false;
    if (source) {
      source.stop();
      source.disconnect();
    }
    lastEventTime = Date.now();
    lastEventWasOn = false;

    // Update display to show this on interval
    renderCurrentRecording();
  }
});

newBtn.onclick = function() {
  currentRecording = [];
  display.innerHTML = '';
  firstPressHappened = false;
  lastEventWasOn = false;
  isRecording = false;
};

saveBtn.onclick = function() {
  var t = titleInput.value.trim();
  if(!t) return;
  var data = {title: t, recording: currentRecording.slice()};
  var stored = JSON.parse(localStorage.getItem('vibrations') || '[]');
  
  // Add the new recording at the start of the array so newest is on top
  stored.unshift(data);
  
  localStorage.setItem('vibrations', JSON.stringify(stored));
  renderList();
};

playBtn.onclick = function() {
  playSequence(currentRecording.slice());
};

function playSequence(seq) {
  if (!seq.length || !audioBuffer) return;
  var segment = seq.shift();
  if (segment.type === 'on') {
    // play sound for 'on' duration
    var s = ctx.createBufferSource();
    s.buffer = audioBuffer;
    s.connect(ctx.destination);
    s.start();
    setTimeout(function() {
      s.stop();
      playSequence(seq);
    }, segment.duration);
  } else {
    // 'off' segment, stay silent for duration
    setTimeout(function() {
      playSequence(seq);
    }, segment.duration);
  }
}

function renderCurrentRecording() {
  display.innerHTML = '';
  var pos = 0;
  currentRecording.forEach(function(segment) {
    var bar = document.createElement('div');
    if (segment.type === 'on') {
      bar.className = 'vibration-bar';
    } else {
      bar.className = 'off-bar';
    }
    bar.style.height = (segment.duration / 10) + 'px';
    bar.style.left = pos + 'px';
    display.appendChild(bar);
    pos += 10;
  });
  display.scrollLeft = display.scrollWidth;
}

function renderList() {
  list.innerHTML = '';
  var stored = JSON.parse(localStorage.getItem('vibrations') || '[]');
  stored.forEach(function(item,i){
    var div = document.createElement('div');
    div.className = 'recording';
    var h = document.createElement('h3');
    h.textContent = item.title;
    div.appendChild(h);

    var totalDuration = item.recording.reduce((sum, seg) => sum+seg.duration, 0);
    var p = document.createElement('p');
    p.textContent = 'Total Length: '+ totalDuration +' ms';
    div.appendChild(p);

    var pb = document.createElement('button');
    pb.textContent = 'Play';
    pb.onclick = function(){
      playSequence(item.recording.slice());
    };
    div.appendChild(pb);

    var rb = document.createElement('button');
    rb.textContent = 'Load';
    rb.onclick = function() {
      currentRecording = item.recording.slice();
      firstPressHappened = currentRecording.length > 0; 
      renderCurrentRecording();
      titleInput.value = item.title;
    };
    div.appendChild(rb);

    var db = document.createElement('button');
    db.textContent = 'Delete';
    db.onclick = function() {
      var all = JSON.parse(localStorage.getItem('vibrations') || '[]');
      all.splice(i,1);
      localStorage.setItem('vibrations', JSON.stringify(all));
      renderList();
    };
    div.appendChild(db);

    list.appendChild(div);
  });
}

renderList();

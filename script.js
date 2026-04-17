const DIALOG_DATA = {
    'intro': { icon: '📜', title: "LYNN'S B-DAY", text: "Welcome to the Adventure at Twin Rivers Resort, Tigoni! Follow the dirt paths to explore the plans for the day." },
    'paintball': { icon: '🎯', title: "PAINTBALLING - KES 1000", text: "Action, strategy, and friendly competition! Get ready for paintball 😄" },
    'pottery': { icon: '🎨', title: "POT PAINTING - KES 500", text: "Unwind and get creative. Paint your own pot as a keepsake! 🌱" },
    'picnic': { icon: '🧺', title: "PICNIC TIME - KES 700", text: "Relaxed vibes and music! Please suggest the food and drinks you want, and we'll compile a final list afterwards to see what to get. 😊" },
    'cake': { icon: '🍰', title: "CAKE & CELEBRATIONS", text: "We'll wrap up the day with cake! 🎂" },
    'rsvp': { icon: '📬', title: "RSVP NOW", text: "Ready to join the party?<br><button id='game-rsvp-btn' class='retro-btn'>ACCEPT QUEST</button>" }
};

// Procedural Map Waypoints
const PATH_POINTS = [
    { x: 300, y: 300, id: 'intro' },
    { x: 1200, y: 400, id: 'paintball' },
    { x: 1900, y: 1000, id: 'pottery' },
    { x: 1200, y: 1600, id: 'picnic' },
    { x: 500, y: 2200, id: 'cake' },
    { x: 2100, y: 2100, id: 'rsvp' }
];

const WORLD_W = 2500;
const WORLD_H = 2500;
const TRIGGER_DISTANCE = 160;

// Game State
const state = {
    x: 230, y: 350, // Start slightly off the path center so it looks cooler
    speed: 7,
    keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false },
    joystick: { x: 0, y: 0, active: false },
    activePoi: null
};

// DOM Elements
const world = document.getElementById('world');
const player = document.getElementById('player');
const playerSprite = document.querySelector('.player-sprite');
const dialogContainer = document.getElementById('dialog-container');
const rsvpModal = document.getElementById('rsvp-modal');
const pois = Array.from(document.querySelectorAll('.poi'));
const trailPath = document.getElementById('trail-path');
const natureLayer = document.getElementById('nature-layer');

// --- PROCEDURAL GENERATION --- //

// 1. Draw the SVG Trail Connecting Waypoints ORTHOGONALLY
function buildTrail() {
    let d = `M ${PATH_POINTS[0].x} ${PATH_POINTS[0].y} `;
    
    for(let i=0; i<PATH_POINTS.length - 1; i++) {
        let curr = PATH_POINTS[i];
        let next = PATH_POINTS[i+1];
        // Draw horizontal line to the X coord of the next point, then vertical to the Y coord
        d += `H ${next.x} V ${next.y} `;
    }
    
    trailPath.setAttribute('d', d);
}

// 2. Align POIs to Waypoints
function placePOIs() {
    PATH_POINTS.forEach(pt => {
        const el = document.getElementById(`poi-${pt.id}`);
        if(el) {
            el.style.left = `${pt.x}px`;
            el.style.top = `${pt.y}px`;
            el.style.zIndex = pt.y; // Y-based sorting
        }
    });
}

// Math Utility for Nature distance checking
function distToSegment(px, py, x1, y1, x2, y2) {
    let l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    let nx = x1 + t * (x2 - x1);
    let ny = y1 + t * (y2 - y1);
    return Math.sqrt(Math.pow(px - nx, 2) + Math.pow(py - ny, 2));
}

// 3. Generate Sparse Trees/Rocks
function buildNature() {
    const emojis = ['🌲', '🌳', '🌸', '🪨', '🌿', '🍂'];
    const numItems = 45; // Sparse, spread out mapping per request
    let fragments = [];

    for (let i = 0; i < numItems; i++) {
        let x = Math.random() * WORLD_W;
        let y = Math.random() * WORLD_H;
        
        let tooClose = false;
        // Check dist to path segments loosely to keep trails clear
        for(let j=0; j<PATH_POINTS.length - 1; j++) {
            let curr = PATH_POINTS[j];
            let next = PATH_POINTS[j+1];
            
            // Check horizontal segment
            let d1 = distToSegment(x, y, curr.x, curr.y, next.x, curr.y);
            // Check vertical segment
            let d2 = distToSegment(x, y, next.x, curr.y, next.x, next.y);
            
            if (d1 < 140 || d2 < 140) {
                tooClose = true; break;
            }
        }
        
        if (!tooClose) {
            let emoji = emojis[Math.floor(Math.random() * emojis.length)];
            let size = Math.random() * 2 + 1.5; // 1.5rem to 3.5rem
            let prop = document.createElement('div');
            prop.className = 'nature-prop';
            prop.innerText = emoji;
            prop.style.left = `${x}px`;
            prop.style.top = `${y}px`;
            prop.style.fontSize = `${size}rem`;
            prop.style.zIndex = Math.floor(y); // depth sorting!
            natureLayer.appendChild(prop);
        }
    }
}

// Run Gen
buildTrail();
placePOIs();
buildNature();


// --- INPUT & MOVEMENT LOGIC --- //

window.addEventListener('keydown', e => { if (state.keys.hasOwnProperty(e.key)) state.keys[e.key] = true; });
window.addEventListener('keyup', e => { if (state.keys.hasOwnProperty(e.key)) state.keys[e.key] = false; });

const joyZone = document.getElementById('joystick-zone');
const joyStick = document.getElementById('joystick-stick');
const joyBase = document.getElementById('joystick-base');

// Force display on mobile via JS (Bulletproof fallback)
if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
    joyZone.style.setProperty('display', 'flex', 'important');
    let blinkEl = document.querySelector('.status-bar .blink');
    if (blinkEl) blinkEl.style.setProperty('display', 'none', 'important');
}

function handleTouch(e) {
    if(!state.joystick.active) return;
    e.preventDefault();
    const touch = [...e.changedTouches].find(t => t.identifier === state.joystick.id);
    if (!touch) return;
    const rect = joyBase.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = touch.clientX - centerX;
    let dy = touch.clientY - centerY;
    const distance = Math.min(Math.sqrt(dx*dx + dy*dy), 40);
    const angle = Math.atan2(dy, dx);
    const stickX = Math.cos(angle) * distance;
    const stickY = Math.sin(angle) * distance;
    joyStick.style.transform = `translate(${stickX}px, ${stickY}px)`;
    state.joystick.x = stickX / 40;
    state.joystick.y = stickY / 40;
}

joyZone.addEventListener('touchstart', (e) => {
    state.joystick.active = true;
    state.joystick.id = e.changedTouches[0].identifier;
    handleTouch(e);
}, {passive: false});

joyZone.addEventListener('touchmove', handleTouch, {passive: false});
const endTouch = (e) => {
    const touch = [...e.changedTouches].find(t => t.identifier === state.joystick.id);
    if(touch) {
        state.joystick.active = false;
        state.joystick.x = 0; state.joystick.y = 0;
        joyStick.style.transform = 'translate(0px, 0px)';
    }
};
joyZone.addEventListener('touchend', endTouch);
joyZone.addEventListener('touchcancel', endTouch);

function getDistance(x1, y1, x2, y2) { return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)); }

function setActiveDialog(poiElement) {
    if (!poiElement) {
        if(state.activePoi) {
            dialogContainer.classList.add('hidden');
            state.activePoi = null;
        }
        return;
    }
    if (state.activePoi === poiElement) return;
    
    const type = poiElement.getAttribute('data-type');
    const data = DIALOG_DATA[type];
    
    document.getElementById('dialog-icon').innerText = data.icon;
    document.getElementById('dialog-title').innerText = data.title;
    document.getElementById('dialog-text').innerHTML = data.text;
    
    dialogContainer.classList.remove('hidden');
    state.activePoi = poiElement;

    const btn = document.getElementById('game-rsvp-btn');
    if (btn) btn.onclick = () => rsvpModal.classList.remove('hidden');
}

document.getElementById('close-modal-btn').addEventListener('click', () => rsvpModal.classList.add('hidden'));

// --- GAME LOOP --- //
function update() {
    let dx = 0, dy = 0;
    if (state.keys.w || state.keys.ArrowUp) dy -= 1;
    if (state.keys.s || state.keys.ArrowDown) dy += 1;
    if (state.keys.a || state.keys.ArrowLeft) dx -= 1;
    if (state.keys.d || state.keys.ArrowRight) dx += 1;

    if (state.joystick.active) { dx = state.joystick.x; dy = state.joystick.y; }

    const mag = Math.sqrt(dx*dx + dy*dy);
    if (mag > 0) {
        dx = (dx / mag) * state.speed;
        dy = (dy / mag) * state.speed;
        if (dx < 0) playerSprite.style.transform = 'scaleX(1)';
        else if (dx > 0) playerSprite.style.transform = 'scaleX(-1)';
    }

    state.x += dx; state.y += dy;
    state.x = Math.max(30, Math.min(WORLD_W - 30, state.x));
    state.y = Math.max(30, Math.min(WORLD_H - 30, state.y));

    // Y-Sorting Depth logic for Player! (so you can walk behind/in front of trees)
    player.style.left = `${state.x}px`;
    player.style.top = `${state.y}px`;
    player.style.zIndex = Math.floor(state.y); 

    // Smooth Camera Follow
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    let camX = -state.x + viewW / 2;
    let camY = -state.y + viewH / 2;
    
    camX = Math.min(0, Math.max(-WORLD_W + viewW, camX));
    camY = Math.min(0, Math.max(-WORLD_H + viewH, camY));

    world.style.transform = `translate(${camX}px, ${camY}px)`;

    // Check Proximity Proximity to statically placed POIs
    let closestPoi = null;
    let minDistance = TRIGGER_DISTANCE;
    
    // Use the known exact coordinates from PATH_POINTS array for precision matching!
    for (let i=0; i<PATH_POINTS.length; i++) {
        let pt = PATH_POINTS[i];
        let d = getDistance(state.x, state.y, pt.x, pt.y);
        if (d < minDistance) {
            minDistance = d;
            closestPoi = document.getElementById(`poi-${pt.id}`);
        }
    }

    setActiveDialog(closestPoi);

    requestAnimationFrame(update);
}

requestAnimationFrame(update);

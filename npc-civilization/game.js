import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

// ── Constants ──────────────────────────────────────────────
const COLS = 20, ROWS = 14, TILE = 40;
const W = COLS * TILE, H = ROWS * TILE;
const TILE_TYPE = { GRASS: 0, WATER: 1, TREE: 2, BERRY: 3, ROCK: 4, SHELTER: 5 };
const TILE_COLOR = {
  [TILE_TYPE.GRASS]:   0x4a7c59, [TILE_TYPE.WATER]:  0x2980b9,
  [TILE_TYPE.TREE]:    0x2d5a27, [TILE_TYPE.BERRY]:  0x8b4513,
  [TILE_TYPE.ROCK]:    0x7f8c8d, [TILE_TYPE.SHELTER]: 0xd4a017,
};
const DIRS = { n: [0,-1], s: [0,1], e: [1,0], w: [-1,0] };
const TILE_LABEL = { [TILE_TYPE.GRASS]: "grass", [TILE_TYPE.WATER]: "water", [TILE_TYPE.TREE]: "tree", [TILE_TYPE.BERRY]: "berry bush", [TILE_TYPE.ROCK]: "rock", [TILE_TYPE.SHELTER]: "shelter" };

// spriteCol/spriteRow = top-left of this character's 3×4 block in chars.png (12 cols, 21 rows of 32×32)
const NPC_DEFS = [
  { name: "Finn",  color: 0x4CAF50, spriteCol: 0, spriteRow: 4,  personality: "friendly and generous. You like to share food and help others. You value community." },
  { name: "Greta", color: 0xFF9800, spriteCol: 3, spriteRow: 8,  personality: "shrewd and calculating. You hoard resources and drive hard bargains. Trust is earned." },
  { name: "Oak",   color: 0x795548, spriteCol: 6, spriteRow: 4,  personality: "practical and focused on building. You want shelter above all else. Methodical." },
  { name: "Luna",  color: 0x9C27B0, spriteCol: 0, spriteRow: 16, personality: "curious and adventurous. You explore every corner. Easily distracted by new things." },
  { name: "Rex",   color: 0xF44336, spriteCol: 9, spriteRow: 4,  personality: "competitive and territorial. You want the most resources. Others are rivals." },
];
const SHEET_COLS = 12; // columns in the spritesheet
const DIR_TO_ANIM = { s: 0, w: 1, e: 2, n: 3 }; // row offset within a character's 4-row block

// ── World ──────────────────────────────────────────────────
let world = [];

function generateWorld() {
  const map = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE_TYPE.GRASS));
  // pond
  const px = 8 + (Math.random() * 4 | 0), py = 4 + (Math.random() * 4 | 0);
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = px + dx, ny = py + dy;
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) map[ny][nx] = TILE_TYPE.WATER;
  }
  // scatter resources
  const scatter = (type, count) => {
    let placed = 0;
    while (placed < count) {
      const x = Math.random() * COLS | 0, y = Math.random() * ROWS | 0;
      if (map[y][x] === TILE_TYPE.GRASS) { map[y][x] = type; placed++; }
    }
  };
  scatter(TILE_TYPE.TREE, 30);
  scatter(TILE_TYPE.BERRY, 12);
  scatter(TILE_TYPE.ROCK, 8);
  return map;
}

function tileAt(x, y) {
  if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return null;
  return world[y][x];
}

// ── NPCs ───────────────────────────────────────────────────
class NPC {
  constructor(def, x, y) {
    Object.assign(this, def);
    this.x = x; this.y = y;
    this.hunger = 2;
    this.inventory = { food: 1, wood: 0 };
    this.hasShelter = false;
    this.memory = [];
    this.lastThought = "";
    this.lastSpeech = "";
    this.alive = true;
    this.facing = "s";
    this.sprite = null; // set by scene
    this.charSprite = null;
    this.label = null;
    this.bubble = null;
  }

  addMemory(text) {
    this.memory.push(text);
    if (this.memory.length > 6) this.memory.shift();
  }

  getPerception(allNPCs) {
    const nearby = [];
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const t = tileAt(this.x + dx, this.y + dy);
      if (t !== null && t !== TILE_TYPE.GRASS) {
        const dist = Math.abs(dx) + Math.abs(dy);
        nearby.push(`${TILE_LABEL[t]} at (${this.x+dx},${this.y+dy}) dist=${dist}`);
      }
    }
    const others = allNPCs.filter(n => n !== this && n.alive).map(n => {
      const dist = Math.abs(n.x - this.x) + Math.abs(n.y - this.y);
      return `${n.name} at (${n.x},${n.y}) dist=${dist}`;
    });
    return { nearby: nearby.slice(0, 8), others };
  }
}

// ── LLM ────────────────────────────────────────────────────
let engine = null;

async function initLLM(onProgress) {
  engine = await CreateMLCEngine("gemma-2-2b-it-q4f16_1-MLC", {
    initProgressCallback: onProgress,
  });
}

function buildPrompt(npc, allNPCs) {
  const { nearby, others } = npc.getPerception(allNPCs);
  return `You are ${npc.name}. ${npc.personality}

STATE: pos=(${npc.x},${npc.y}) hunger=${npc.hunger}/10 food=${npc.inventory.food} wood=${npc.inventory.wood} shelter=${npc.hasShelter}

NEARBY TILES:
${nearby.length ? nearby.join("\n") : "nothing special"}

OTHER VILLAGERS:
${others.length ? others.join("\n") : "none visible"}

MEMORY:
${npc.memory.length ? npc.memory.join("\n") : "nothing yet"}

ACTIONS (pick ONE):
- move: go n/s/e/w
- gather: pick up resource from adjacent tree (wood) or berry bush (food)
- eat: consume 1 food to reduce hunger by 3
- build: spend 3 wood to build shelter
- talk: say something to a nearby villager

Respond with ONLY valid JSON, no other text:
{"action":"move|gather|eat|build|talk","dir":"n|s|e|w","target":"name","message":"what you say","thought":"brief reasoning"}`;
}

async function queryNPC(npc, allNPCs) {
  const prompt = buildPrompt(npc, allNPCs);
  try {
    const res = await engine.chat.completions.create({
      messages: [
        { role: "user", content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 120,
    });
    const raw = res.choices[0].message.content;
    return parseAction(raw);
  } catch (e) {
    console.warn(`LLM error for ${npc.name}:`, e);
    return { action: "move", dir: ["n","s","e","w"][Math.random()*4|0], thought: "confused" };
  }
}

function parseAction(raw) {
  try {
    // try direct parse
    const obj = JSON.parse(raw);
    return obj;
  } catch {
    // try extracting JSON from markdown code block or mixed text
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
  }
  // fallback
  return { action: "move", dir: ["n","s","e","w"][Math.random()*4|0], thought: "couldn't decide" };
}

// ── Action Execution ───────────────────────────────────────
function executeAction(npc, action, allNPCs) {
  const a = action.action || "move";
  npc.lastThought = action.thought || "";
  npc.lastSpeech = "";

  switch (a) {
    case "move": {
      const d = DIRS[action.dir] || DIRS.n;
      const nx = npc.x + d[0], ny = npc.y + d[1];
      const t = tileAt(nx, ny);
      if (t !== null && t !== TILE_TYPE.WATER && t !== TILE_TYPE.TREE && t !== TILE_TYPE.ROCK) {
        npc.x = nx; npc.y = ny;
        npc.addMemory(`Moved ${action.dir}`);
        return `moved ${action.dir}`;
      }
      npc.addMemory(`Tried to move ${action.dir} but blocked`);
      return `blocked ${action.dir}`;
    }
    case "gather": {
      // check adjacent tiles for resources
      for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
        const gx = npc.x + dx, gy = npc.y + dy;
        const t = tileAt(gx, gy);
        if (t === TILE_TYPE.TREE) {
          npc.inventory.wood++;
          world[gy][gx] = TILE_TYPE.GRASS;
          npc.addMemory(`Gathered wood (now ${npc.inventory.wood})`);
          return `gathered wood`;
        }
        if (t === TILE_TYPE.BERRY) {
          npc.inventory.food++;
          world[gy][gx] = TILE_TYPE.GRASS;
          npc.addMemory(`Gathered food (now ${npc.inventory.food})`);
          return `gathered food`;
        }
      }
      npc.addMemory("Tried to gather but nothing nearby");
      return "nothing to gather";
    }
    case "eat": {
      if (npc.inventory.food > 0) {
        npc.inventory.food--;
        npc.hunger = Math.max(0, npc.hunger - 3);
        npc.addMemory(`Ate food (hunger now ${npc.hunger})`);
        return `ate (hunger: ${npc.hunger})`;
      }
      npc.addMemory("Tried to eat but no food");
      return "no food to eat";
    }
    case "build": {
      if (npc.inventory.wood >= 3 && !npc.hasShelter) {
        npc.inventory.wood -= 3;
        npc.hasShelter = true;
        world[npc.y][npc.x] = TILE_TYPE.SHELTER;
        npc.addMemory("Built a shelter!");
        return "built shelter!";
      }
      npc.addMemory("Tried to build but need 3 wood");
      return "can't build";
    }
    case "talk": {
      const msg = action.message || "...";
      const targetName = action.target;
      const target = allNPCs.find(n => n.name === targetName && n.alive);
      npc.lastSpeech = msg;
      if (target) {
        target.addMemory(`${npc.name} said to me: "${msg}"`);
        npc.addMemory(`Said to ${targetName}: "${msg}"`);
        return `said to ${targetName}: "${msg}"`;
      }
      npc.addMemory(`Said aloud: "${msg}"`);
      return `said: "${msg}"`;
    }
    default:
      npc.addMemory("Did nothing");
      return "idle";
  }
}

// ── Phaser Scene ───────────────────────────────────────────
class GameScene extends Phaser.Scene {
  constructor() { super("game"); }

  preload() {
    this.load.spritesheet("chars", "chars.png", { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    world = generateWorld();
    this.mapGfx = this.add.graphics();
    this.npcs = NPC_DEFS.map((def, i) => {
      let x, y;
      do { x = 2 + (Math.random() * (COLS - 4) | 0); y = 2 + (Math.random() * (ROWS - 4) | 0); }
      while (world[y][x] !== TILE_TYPE.GRASS);
      return new NPC(def, x, y);
    });

    // create walking animations + sprites for each NPC
    this.npcGfx = [];
    this.npcs.forEach(npc => {
      // register walk animations: 4 directions × 3 frames each
      for (const [dir, rowOff] of Object.entries(DIR_TO_ANIM)) {
        const row = npc.spriteRow + rowOff;
        const start = row * SHEET_COLS + npc.spriteCol;
        this.anims.create({
          key: `${npc.name}_${dir}`,
          frames: this.anims.generateFrameNumbers("chars", { frames: [start, start + 1, start + 2] }),
          frameRate: 6, repeat: 0,
        });
      }
      const standFrame = npc.spriteRow * SHEET_COLS + npc.spriteCol + 1; // center frame, facing south
      npc.facing = "s";

      const container = this.add.container(0, 0);
      const charSprite = this.add.sprite(0, 0, "chars", standFrame).setScale(TILE / 32);
      const label = this.add.text(0, -TILE / 1.4, npc.name, {
        fontSize: "11px", color: "#fff", fontFamily: "Courier New",
        stroke: "#000", strokeThickness: 2,
      }).setOrigin(0.5);
      const bubble = this.add.text(0, -TILE * 1.3, "", {
        fontSize: "10px", color: "#ffd700", fontFamily: "Courier New",
        wordWrap: { width: 120 }, stroke: "#000", strokeThickness: 2,
      }).setOrigin(0.5, 1).setAlpha(0);
      container.add([charSprite, label, bubble]);
      npc.sprite = container;
      npc.charSprite = charSprite;
      npc.label = label;
      npc.bubble = bubble;
      this.npcGfx.push(container);
    });

    this.drawMap();
    this.updateNPCPositions();
    this.turn = 0;
    this.processing = false;
    this.autoPlay = false;
    this.speed = 1; // 1 = normal, 2 = fast (skip delays)

    // UI hooks
    document.getElementById("btn-step").disabled = false;
    document.getElementById("btn-auto").disabled = false;
    document.getElementById("btn-step").onclick = () => { if (!this.processing) this.runTurn(); };
    document.getElementById("btn-auto").onclick = () => {
      this.autoPlay = !this.autoPlay;
      document.getElementById("btn-auto").textContent = this.autoPlay ? "Pause" : "Auto Play";
      if (this.autoPlay && !this.processing) this.runTurn();
    };
    document.getElementById("btn-speed").onclick = () => {
      this.speed = this.speed === 1 ? 2 : 1;
      document.getElementById("btn-speed").textContent = this.speed === 1 ? "Speed: Normal" : "Speed: Fast";
    };

    this.updateStatsPanel();
  }

  drawMap() {
    this.mapGfx.clear();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const t = world[y][x];
      this.mapGfx.fillStyle(TILE_COLOR[t], 1);
      this.mapGfx.fillRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
      // resource icons
      if (t === TILE_TYPE.TREE) {
        this.mapGfx.fillStyle(0x1b8a1b, 1);
        this.mapGfx.fillTriangle(x*TILE+TILE/2, y*TILE+6, x*TILE+8, y*TILE+TILE-6, x*TILE+TILE-8, y*TILE+TILE-6);
      } else if (t === TILE_TYPE.BERRY) {
        this.mapGfx.fillStyle(0xe74c3c, 1);
        this.mapGfx.fillCircle(x*TILE+TILE/2, y*TILE+TILE/2, 5);
        this.mapGfx.fillCircle(x*TILE+TILE/2-6, y*TILE+TILE/2+4, 4);
        this.mapGfx.fillCircle(x*TILE+TILE/2+6, y*TILE+TILE/2+4, 4);
      } else if (t === TILE_TYPE.SHELTER) {
        this.mapGfx.fillStyle(0xf39c12, 1);
        this.mapGfx.fillTriangle(x*TILE+TILE/2, y*TILE+4, x*TILE+4, y*TILE+TILE-4, x*TILE+TILE-4, y*TILE+TILE-4);
      }
    }
  }

  updateNPCPositions(movingNpc, dir) {
    this.npcs.forEach(npc => {
      if (!npc.alive) { npc.sprite.setAlpha(0.2); return; }
      const tx = npc.x * TILE + TILE / 2, ty = npc.y * TILE + TILE / 2;
      if (npc === movingNpc && dir) {
        npc.facing = dir;
        npc.charSprite.play(`${npc.name}_${dir}`);
        this.tweens.add({ targets: npc.sprite, x: tx, y: ty, duration: 300, ease: "Power1" });
      } else {
        npc.sprite.setPosition(tx, ty);
      }
      // set idle frame based on facing
      if (!npc.charSprite.anims.isPlaying) {
        const row = npc.spriteRow + DIR_TO_ANIM[npc.facing || "s"];
        npc.charSprite.setFrame(row * SHEET_COLS + npc.spriteCol + 1);
      }
    });
  }

  showBubble(npc, text) {
    npc.bubble.setText(text).setAlpha(1);
    this.time.delayedCall(this.speed === 1 ? 2500 : 1000, () => npc.bubble.setAlpha(0));
  }

  async runTurn() {
    if (this.processing) return;
    this.processing = true;
    this.turn++;
    document.getElementById("turn-num").textContent = this.turn;
    document.getElementById("sim-status").textContent = "Processing...";
    document.getElementById("btn-step").disabled = true;

    // hunger tick
    this.npcs.forEach(npc => {
      if (!npc.alive) return;
      npc.hunger = Math.round((npc.hunger + 0.5) * 10) / 10;
      if (npc.hunger >= 10) {
        npc.alive = false;
        npc.addMemory("Died of hunger");
        this.logEvent(npc, "starved!");
      }
    });

    // process each NPC
    const alive = this.npcs.filter(n => n.alive);
    for (const npc of alive) {
      this.highlightNPC(npc, true);
      document.getElementById("sim-status").textContent = `${npc.name} thinking...`;
      this.updateStatsPanel(npc.name);

      const action = await queryNPC(npc, this.npcs);
      const result = executeAction(npc, action, this.npcs);
      const moveDir = (action.action === "move" && !result.startsWith("blocked")) ? action.dir : null;

      this.drawMap();
      this.updateNPCPositions(npc, moveDir);
      if (npc.lastSpeech) this.showBubble(npc, `"${npc.lastSpeech}"`);
      this.logEvent(npc, result);
      this.highlightNPC(npc, false);
      this.updateStatsPanel();

      if (this.speed === 1) await this.delay(600);
    }

    // resource regrowth (small chance)
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      if (world[y][x] === TILE_TYPE.GRASS && Math.random() < 0.01) {
        world[y][x] = Math.random() < 0.6 ? TILE_TYPE.TREE : TILE_TYPE.BERRY;
      }
    }
    this.drawMap();

    document.getElementById("sim-status").textContent = "Idle";
    document.getElementById("btn-step").disabled = false;
    this.processing = false;

    if (this.autoPlay && this.npcs.some(n => n.alive)) {
      await this.delay(this.speed === 1 ? 800 : 200);
      this.runTurn();
    }
  }

  highlightNPC(npc, on) {
    const card = document.querySelector(`.npc-card[data-name="${npc.name}"]`);
    if (card) card.classList.toggle("thinking", on);
  }

  logEvent(npc, text) {
    const log = document.getElementById("event-log");
    const entry = document.createElement("div");
    entry.className = "entry";
    const isSpeech = text.startsWith("said");
    entry.innerHTML = `<span class="turn">T${this.turn}</span> <span class="speaker" style="color:${hexStr(npc.color)}">${npc.name}</span>: ${isSpeech ? `<span class="speech">${text}</span>` : text}`;
    log.prepend(entry);
    // keep log manageable
    while (log.children.length > 80) log.removeChild(log.lastChild);
  }

  updateStatsPanel(thinkingName) {
    const el = document.getElementById("npc-stats");
    el.innerHTML = this.npcs.map(npc => {
      const alive = npc.alive;
      const thinking = npc.name === thinkingName;
      return `<div class="npc-card ${thinking ? 'thinking' : ''}" data-name="${npc.name}" style="border-color:${hexStr(npc.color)}; ${alive ? '' : 'opacity:0.4'}">
        <div class="name" style="color:${hexStr(npc.color)}">${npc.name} ${alive ? '' : '☠️'} ${thinking ? '💭' : ''}</div>
        <div class="stat">hunger: ${'█'.repeat(Math.min(10, Math.round(npc.hunger)))}${'░'.repeat(Math.max(0, 10 - Math.round(npc.hunger)))} ${npc.hunger}/10</div>
        <div class="stat">food: ${npc.inventory.food} · wood: ${npc.inventory.wood} ${npc.hasShelter ? '· 🏠' : ''}</div>
        ${npc.lastThought ? `<div class="thought">"${npc.lastThought}"</div>` : ''}
      </div>`;
    }).join("");
  }

  delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

function hexStr(n) { return "#" + n.toString(16).padStart(6, "0"); }

// ── Boot ───────────────────────────────────────────────────
async function boot() {
  const fill = document.getElementById("progress-fill");
  const text = document.getElementById("progress-text");

  await initLLM((progress) => {
    const pct = progress.progress != null ? Math.round(progress.progress * 100) : 0;
    fill.style.width = pct + "%";
    text.textContent = progress.text || "Loading...";
  });

  text.textContent = "Model loaded! Starting simulation...";
  fill.style.width = "100%";
  await new Promise(r => setTimeout(r, 600));
  document.getElementById("loading-overlay").classList.add("hidden");

  new Phaser.Game({
    type: Phaser.AUTO,
    width: W,
    height: H,
    parent: "game-container",
    backgroundColor: "#1a1a2e",
    scene: [GameScene],
  });
}

boot().catch(err => {
  document.getElementById("progress-text").textContent = `Error: ${err.message}. Need WebGPU-capable browser (Chrome 113+).`;
  console.error(err);
});

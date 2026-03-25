/**
 * SURVIVAL FARMER: OVERCOMING HUNGER v2.0
 * Implementation by Antigravity AI
 */

const SEEDS = [
    { id: 'carrot', name: 'Carrot', icon: '🥕', cost: 5, nutrition: 15, growthTime: 5000 },
    { id: 'wheat', name: 'Wheat', icon: '🌾', cost: 12, nutrition: 30, growthTime: 12000 },
    { id: 'sunflower', name: 'Sunflower', icon: '🌻', cost: 25, nutrition: 60, growthTime: 30000 },
    { id: 'blueberry', name: 'Blueberry', icon: '🫐', cost: 50, nutrition: 120, growthTime: 60000 },
    { id: 'melon', name: 'Melon', icon: '🍉', cost: 100, nutrition: 280, growthTime: 120000 },
    { id: 'pumpkin', name: 'Pumpkin', icon: '🎃', cost: 200, nutrition: 600, growthTime: 300000 }
];

class SurvivalGame {
    constructor() {
        // Core State
        this.sunlight = 20;
        this.hunger = 100;
        this.foodStorage = 0;
        this.selectedSeed = SEEDS[0];
        this.farmGridData = Array(64).fill(null);
        this.startTime = Date.now();
        this.gameOver = false;
        this.lastTime = 0;
        this.harvests = 0;
        this.currentDay = 1;
        this.dayDuration = 120000; // 2 minutes per day
        this.lastClosestIndex = -1;

        // Player State
        this.player = {
            x: 400,
            y: 450,
            speed: 380, // Pixels per second
            dir: 1,
            isMoving: false
        };
        this.keys = {};

        // Systems
        this.particles = [];
        this.canvas = document.getElementById('particle-canvas');
        this.ctx = this.canvas?.getContext('2d');

        this.init();
    }

    init() {
        this.resize();
        this.renderSeedsUI();
        this.renderGridUI();
        this.setupControls();
        this.setupEatAction();

        // Start Loops
        requestAnimationFrame((t) => this.gameUpdate(t));
        this.startSurvivalTick();

        window.addEventListener('resize', () => this.resize());
        this.notify('🌳 Welcome to Survival Farm!', 'linear-gradient(90deg, #4CAF50, #81c784)');
    }

    resize() {
        if (this.canvas) {
            this.canvas.width = 800;
            this.canvas.height = 800;
        }
    }

    setupControls() {
        window.addEventListener('keydown', e => {
            const key = e.key.toLowerCase();
            this.keys[key] = true;
            // Hotkeys for seeds
            if (key >= '1' && key <= '6') {
                const idx = parseInt(key) - 1;
                if (SEEDS[idx]) this.selectSeed(SEEDS[idx]);
            }
            if (key === ' ' || key === 'e') this.attemptInteraction();
        });
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
    }

    setupEatAction() {
        const btn = document.getElementById('eat-btn');
        if (btn) btn.onclick = () => this.eatFood();
    }

    gameUpdate(timestamp) {
        if (this.gameOver) return;

        const deltaTime = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        this.updateMovement(deltaTime);
        this.updateParticles(deltaTime);
        this.checkInteractionDistance();

        requestAnimationFrame((t) => this.gameUpdate(t));
    }

    updateMovement(dt) {
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;

        if (dx !== 0 && dy !== 0) { const mag = Math.sqrt(dx * dx + dy * dy); dx /= mag; dy /= mag; }

        if (dx !== 0 || dy !== 0) {
            this.player.isMoving = true;
            this.player.x += dx * this.player.speed * dt;
            this.player.y += dy * this.player.speed * dt;

            // Constrain to 800x800 scene
            this.player.x = Math.max(30, Math.min(800 - 30, this.player.x));
            this.player.y = Math.max(30, Math.min(800 - 30, this.player.y));

            if (dx > 0) this.player.dir = 1; else if (dx < 0) this.player.dir = -1;
        } else {
            this.player.isMoving = false;
        }

        const playerEl = document.getElementById('player');
        if (playerEl) {
            playerEl.style.left = `${this.player.x - 32}px`;
            playerEl.style.top = `${this.player.y - 32}px`;
            playerEl.classList.toggle('walking', this.player.isMoving);
            playerEl.querySelector('.player-visual').style.transform = `scaleX(${this.player.dir})`;

            // Spawn walking particles
            if (this.player.isMoving && Math.random() > 0.8) {
                this.spawnParticles(this.player.x, this.player.y + 20, 'rgba(141, 110, 99, 0.4)', 1);
            }
        }
    }

    startSurvivalTick() {
        setInterval(() => {
            if (this.gameOver) return;

            // Hunger Decay & Sunlight Gain
            this.hunger -= 0.65; // Much slower decay for better survival experience
            this.sunlight += 0.2; // Small passive sunlight gain to prevent softlocks
            if (this.hunger <= 0) this.die();

            // Growth Loop
            const now = Date.now();
            this.farmGridData.forEach((tile, index) => {
                if (!tile || tile.stage === 'ready') return;

                const elapsed = now - tile.plantedAt;
                const progress = elapsed / tile.growthTime;

                let newStage = 'seedling';
                if (progress >= 1) newStage = 'ready';
                else if (progress > 0.4) newStage = 'growing';

                if (newStage !== tile.stage) {
                    tile.stage = newStage;
                    this.refreshTileUI(index);
                }
            });

            // Day cycle
            const elapsedSinceDayStart = (Date.now() - this.startTime) % this.dayDuration;
            const newDay = Math.floor((Date.now() - this.startTime) / this.dayDuration) + 1;
            if (newDay !== this.currentDay) {
                this.currentDay = newDay;
                this.notify(`Day ${this.currentDay} Begins!`, 'var(--accent)');
            }

            this.updateMainUI();
        }, 1000);
    }

    checkInteractionDistance() {
        const px = this.player.x;
        const py = this.player.y;

        let closestIndex = -1;
        let minDist = 100;
        const tiles = document.querySelectorAll('.tile');

        for (let i = 0; i < 64; i++) {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const tx = 81.5 + col * 91;
            const ty = 81.5 + row * 91;
            const dist = Math.sqrt((px - tx) ** 2 + (py - ty) ** 2);

            if (dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        }

        // Only update DOM if the target tile changed
        if (closestIndex !== this.lastClosestIndex) {
            // Cleanup previous
            if (this.lastClosestIndex !== -1) {
                const lastTile = tiles[this.lastClosestIndex];
                if (lastTile) {
                    lastTile.classList.remove('near');
                    const ghost = lastTile.querySelector('.ghost-preview');
                    if (ghost) ghost.remove();
                }
            }

            // Apply new
            if (closestIndex !== -1) {
                const targetTile = tiles[closestIndex];
                targetTile.classList.add('near');

                // Ghost Preview
                if (!this.farmGridData[closestIndex]) {
                    const ghost = document.createElement('div');
                    ghost.className = 'ghost-preview';
                    ghost.textContent = this.selectedSeed.icon;
                    targetTile.appendChild(ghost);
                }
            }

            this.lastClosestIndex = closestIndex;
            document.getElementById('player').classList.toggle('show-interaction', closestIndex !== -1);
        }
    }

    attemptInteraction() {
        if (this.gameOver) return;

        let closestIndex = -1;
        let minDist = 100;

        for (let i = 0; i < 64; i++) {
            const row = Math.floor(i / 8);
            const col = i % 8;
            const tx = 81.5 + col * 91;
            const ty = 81.5 + row * 91;
            const dist = Math.sqrt((this.player.x - tx) ** 2 + (this.player.y - ty) ** 2);
            if (dist < minDist) {
                minDist = dist;
                closestIndex = i;
            }
        }

        if (closestIndex !== -1) {
            this.handleTileAction(closestIndex);
        }
    }

    handleTileAction(index) {
        const tile = this.farmGridData[index];
        const row = Math.floor(index / 8);
        const col = index % 8;
        const tx = 81.5 + col * 91;
        const ty = 81.5 + row * 91;

        if (!tile) {
            // Plant
            if (this.sunlight >= this.selectedSeed.cost) {
                this.sunlight -= this.selectedSeed.cost;
                this.farmGridData[index] = {
                    ...this.selectedSeed,
                    stage: 'seedling',
                    plantedAt: Date.now()
                };
                this.refreshTileUI(index);
                this.spawnParticles(tx, ty, '#8d6e63', 10);
                this.notify(`Planted ${this.selectedSeed.name}`, 'var(--primary-light)');
                this.updateMainUI();
            } else {
                this.notify('☀️ Not enough light!', 'var(--danger-light)');
            }
        } else if (tile.stage === 'ready') {
            // Harvest
            this.foodStorage += tile.nutrition;
            this.sunlight += Math.floor(tile.cost * 1.6);
            this.spawnParticles(tx, ty, 'gold', 20);
            this.farmGridData[index] = null;
            this.harvests++;
            this.refreshTileUI(index);
            this.notify(`Harvested ${tile.name}! (+${tile.nutrition} food)`, 'gold');
            this.updateMainUI();
        }
    }

    eatFood() {
        if (this.foodStorage <= 0) {
            this.notify('Basket is empty!', 'var(--danger-light)');
            return;
        }

        const needed = 100 - this.hunger;
        const eatAmount = Math.min(this.foodStorage, needed);

        if (eatAmount > 0) {
            this.hunger += eatAmount;
            this.foodStorage -= eatAmount;
            this.notify('🍎 Delicious! +Life', 'var(--primary-vibrant)');
            this.updateMainUI();
            this.spawnParticles(this.player.x, this.player.y, '#ff8a80', 15);
        } else {
            this.notify('You are satisfied!', 'lightblue');
        }
    }

    die() {
        this.gameOver = true;
        this.hunger = 0;
        document.getElementById('game-over').classList.remove('hidden');
        document.getElementById('final-time').textContent = document.getElementById('play-time').textContent;
    }

    // UI Rendering
    renderSeedsUI() {
        const container = document.getElementById('seed-selector');
        container.innerHTML = '';
        SEEDS.forEach(seed => {
            const el = document.createElement('div');
            el.className = `seed-item ${this.selectedSeed.id === seed.id ? 'active' : ''}`;
            el.innerHTML = `
                <div class="icon">${seed.icon}</div>
                <div class="cost">${seed.cost}☀️</div>
                <div class="name">${seed.name}</div>
            `;
            el.onclick = () => this.selectSeed(seed);
            container.appendChild(el);
        });
    }

    selectSeed(seed) {
        this.selectedSeed = seed;
        this.lastClosestIndex = -1; // Force ghost refresh
        this.renderSeedsUI();
    }

    renderGridUI() {
        const grid = document.getElementById('farm-grid');
        grid.innerHTML = '';
        for (let i = 0; i < 64; i++) {
            const el = document.createElement('div');
            el.className = 'tile';
            el.onclick = () => this.handleTileAction(i);
            grid.appendChild(el);
        }
    }

    refreshTileUI(index) {
        const tileEl = document.getElementById('farm-grid').children[index];
        if (!tileEl) return;

        tileEl.innerHTML = '';
        const data = this.farmGridData[index];
        if (data) {
            const crop = document.createElement('div');
            crop.className = `crop ${data.stage}`;
            crop.textContent = data.icon;
            tileEl.appendChild(crop);
        }
    }

    updateMainUI() {
        document.getElementById('hunger-value').textContent = `${Math.ceil(this.hunger)}%`;
        document.getElementById('hunger-bar-fill').style.width = `${Math.max(0, this.hunger)}%`;
        document.getElementById('sunlight-count').textContent = Math.floor(this.sunlight);
        document.getElementById('food-count').textContent = Math.floor(this.foodStorage);

        // Colors
        const fill = document.getElementById('hunger-bar-fill');
        if (this.hunger < 30) fill.style.background = 'var(--danger-dark)';
        else if (this.hunger < 60) fill.style.background = 'var(--accent)';
        else fill.style.background = 'linear-gradient(90deg, var(--primary), var(--primary-light))';

        // Time
        const diff = Math.floor((Date.now() - this.startTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        document.getElementById('play-time').textContent = `${m}:${s}`;

        document.getElementById('day-count').textContent = this.currentDay;
        document.getElementById('harvest-count').textContent = this.harvests;
    }

    notify(msg, color) {
        const area = document.getElementById('notification-area');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.style.borderLeftColor = color || 'var(--primary)';
        toast.innerHTML = `<span>${msg}</span>`;
        area.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(20px)';
            setTimeout(() => toast.remove(), 500);
        }, 3000);
    }

    // Effects System
    spawnParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x, y,
                vx: (Math.random() - 0.5) * 150,
                vy: (Math.random() - 0.5) * 150,
                life: 1.0,
                color: color,
                size: Math.random() * 5 + 2
            });
        }
    }

    updateParticles(dt) {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += 200 * dt; // Gravity
            p.life -= dt * 2;

            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }

            this.ctx.globalAlpha = p.life;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}

window.addEventListener('load', () => new SurvivalGame());

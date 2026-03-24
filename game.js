/**
 * SURVIVAL FARMER: VENCENDO A FOME
 * Regras: A fome diminui a cada segundo. Comida restaura fome.
 */

const SEEDS = [
    { id: 'carrot', name: 'Cenoura', icon: '🥕', cost: 5, nutrition: 15, growthTime: 5000 },
    { id: 'wheat', name: 'Trigo', icon: '🌾', cost: 10, nutrition: 25, growthTime: 12000 },
    { id: 'sunflower', name: 'Girassol', icon: '🌻', cost: 20, nutrition: 50, growthTime: 30000 },
    { id: 'blueberry', name: 'Mirtilo', icon: '🫐', cost: 40, nutrition: 100, growthTime: 50000 },
    { id: 'melon', name: 'Melancia', icon: '🍉', cost: 80, nutrition: 250, growthTime: 90000 }
];

class SurvivalGame {
    constructor() {
        this.sunlight = 20;
        this.hunger = 100;
        this.foodStorage = 0;
        this.selectedSeed = SEEDS[0];
        this.farmGrid = Array(64).fill(null);
        this.startTime = Date.now();
        this.gameOver = false;
        
        this.player = {
            x: window.innerWidth * 0.6,
            y: window.innerHeight * 0.5,
            speed: 6,
            dir: 1
        };
        this.keys = {};
        
        this.init();
    }

    init() {
        this.renderSeeds();
        this.renderGrid();
        this.setupControls();
        this.gameLoop();
        this.startSurvivalLoop();
        this.updateUI();
        
        // Botão de Comer
        document.getElementById('eat-btn').onclick = () => this.eatFood();
    }

    setupControls() {
        window.addEventListener('keydown', e => {
            this.keys[e.key.toLowerCase()] = true;
            if (e.key === ' ' || e.key.toLowerCase() === 'e') this.interactWithClosest();
        });
        window.addEventListener('keyup', e => this.keys[e.key.toLowerCase()] = false);
    }

    gameLoop() {
        if (this.gameOver) return;
        this.updateMovement();
        requestAnimationFrame(() => this.gameLoop());
    }

    updateMovement() {
        let dx = 0, dy = 0;
        if (this.keys['w'] || this.keys['arrowup']) dy -= this.player.speed;
        if (this.keys['s'] || this.keys['arrowdown']) dy += this.player.speed;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= this.player.speed;
        if (this.keys['d'] || this.keys['arrowright']) dx += this.player.speed;

        if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

        if (dx !== 0 || dy !== 0) {
            this.player.x += dx;
            this.player.y += dy;
            this.player.x = Math.max(340, Math.min(window.innerWidth - 60, this.player.x));
            this.player.y = Math.max(60, Math.min(window.innerHeight - 60, this.player.y));
            if (dx > 0) this.player.dir = 1; else if (dx < 0) this.player.dir = -1;
            document.getElementById('player').classList.add('walking');
        } else {
            document.getElementById('player').classList.remove('walking');
        }

        const playerEl = document.getElementById('player');
        if (playerEl) {
            playerEl.style.left = `${this.player.x}px`;
            playerEl.style.top = `${this.player.y}px`;
            playerEl.querySelector('.player-sprite').style.transform = `scaleX(${this.player.dir})`;
        }
    }

    startSurvivalLoop() {
        // Ciclo de Fome e Crescimento
        setInterval(() => {
            if (this.gameOver) return;

            // Fome diminui: -2% a cada segundo
            this.hunger -= 1.5;
            if (this.hunger <= 0) this.die();

            // Crescimento das plantas
            this.farmGrid.forEach((tile, index) => {
                if (!tile || tile.stage === 'ready') return;
                const elapsed = Date.now() - tile.plantedAt;
                const progress = elapsed / tile.growthTime;
                let newStage = 'seedling';
                if (progress >= 1) newStage = 'ready';
                else if (progress > 0.4) newStage = 'growing';

                if (newStage !== tile.stage) {
                    tile.stage = newStage;
                    this.refreshTile(index);
                } else if (tile.stage !== 'ready') {
                    this.refreshTile(index);
                }
            });

            this.updateUI();
            
            // Tempo de sobrevivência
            const diff = Math.floor((Date.now() - this.startTime) / 1000);
            document.getElementById('play-time').textContent = `${Math.floor(diff/60).toString().padStart(2,'0')}:${(diff%60).toString().padStart(2,'0')}`;
        }, 1000);
    }

    interactWithClosest() {
        let closestIndex = -1, minDist = 140;
        document.querySelectorAll('.tile').forEach((tileEl, index) => {
            const rect = tileEl.getBoundingClientRect();
            const d = Math.sqrt(Math.pow(this.player.x - (rect.left + rect.width/2), 2) + Math.pow(this.player.y - (rect.top + rect.height/2), 2));
            if (d < minDist) { minDist = d; closestIndex = index; }
        });
        if (closestIndex !== -1) this.handleTileAction(closestIndex);
    }

    handleTileAction(index) {
        if (this.gameOver) return;
        const tile = this.farmGrid[index];

        if (!tile) {
            // Plantar
            if (this.sunlight >= this.selectedSeed.cost) {
                this.sunlight -= this.selectedSeed.cost;
                this.farmGrid[index] = { ...this.selectedSeed, stage: 'seedling', plantedAt: Date.now() };
                this.updateUI();
                this.notify(`Plantou ${this.selectedSeed.name}!`);
                this.refreshTile(index);
            } else {
                this.notify('Luz Solar insuficiente!', 'rgba(255, 82, 82, 0.9)');
            }
        } else if (tile.stage === 'ready') {
            // Colher - Ganha comida e Sunlight
            this.foodStorage += tile.nutrition;
            this.sunlight += Math.floor(tile.cost * 1.5);
            this.farmGrid[index] = null;
            this.updateUI();
            this.notify(`Colheu ${tile.name}! (+${tile.nutrition} de Comida)`);
            this.refreshTile(index);
        }
    }

    eatFood() {
        if (this.foodStorage <= 0) {
            this.notify('Cesto vazio!', 'orange');
            return;
        }
        
        // Consome comida para recuperar fome
        const eatAmount = Math.min(this.foodStorage, 100 - this.hunger);
        if (eatAmount > 0) {
            this.hunger += eatAmount;
            this.foodStorage -= eatAmount;
            this.notify('Huum, delicioso! +HP', '#4CAF50');
            this.updateUI();
        } else {
            this.notify('Você não está com tanta fome!', 'lightblue');
        }
    }

    die() {
        this.gameOver = true;
        this.hunger = 0;
        document.getElementById('game-over').classList.remove('hidden');
    }

    renderSeeds() {
        const container = document.getElementById('seed-selector');
        container.innerHTML = '';
        SEEDS.forEach(seed => {
            const el = document.createElement('div');
            el.className = `seed-item ${this.selectedSeed.id === seed.id ? 'active' : ''}`;
            el.innerHTML = `<div>${seed.icon}</div><div>${seed.cost}☀️</div>`;
            el.onclick = () => { this.selectedSeed = seed; this.renderSeeds(); };
            container.appendChild(el);
        });
    }

    renderGrid() {
        const grid = document.getElementById('farm-grid');
        grid.innerHTML = '';
        this.farmGrid.forEach((tile, index) => {
            const el = document.createElement('div');
            el.className = 'tile';
            if (tile) el.appendChild(this.createCropElement(tile));
            el.onclick = () => this.handleTileAction(index);
            grid.appendChild(el);
        });
    }

    refreshTile(index) {
        const el = document.getElementById('farm-grid').children[index];
        if (!el) return;
        el.innerHTML = '';
        const tile = this.farmGrid[index];
        if (tile) el.appendChild(this.createCropElement(tile));
    }

    createCropElement(tile) {
        const crop = document.createElement('div');
        crop.className = `crop ${tile.stage}`;
        crop.textContent = tile.icon;
        return crop;
    }

    updateUI() {
        document.getElementById('hunger-bar-fill').style.width = `${Math.max(0, this.hunger)}%`;
        document.getElementById('sunlight-count').textContent = Math.floor(this.sunlight);
        document.getElementById('food-count').textContent = Math.floor(this.foodStorage);
        
        // Cor da barra de fome dependendo do estado
        const fill = document.getElementById('hunger-bar-fill');
        if (this.hunger < 25) fill.style.background = 'red';
        else if (this.hunger < 50) fill.style.background = 'orange';
        else fill.style.background = 'linear-gradient(90deg, #ff5252, #ff8a80)';
    }

    notify(msg, color) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = msg;
        if (color) toast.style.background = color;
        document.getElementById('toast-container').appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }
}

window.onload = () => new SurvivalGame();

/**
 * Chronos Abyss - Main Game Engine & Canvas Renderer
 * Orchestrates turn resolution, animations, camera tracking, particle systems, and UI binding.
 */

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game World Metrics
        this.tileSize = 32;
        this.depth = 1;
        this.turnCount = 0;
        this.score = 0;
        this.rewindsUsed = 0;
        this.isGameOver = false;

        // Entities & Systems
        this.map = new GameMap(36, 26);
        this.player = new Player();
        this.enemies = [];
        this.items = [];
        this.particles = [];

        // Camera Tracking
        this.camera = { x: 0, y: 0 };

        // Visual effects
        this.rewindFxActive = false;

        // Bind DOM references
        this.dom = {
            hudDepth: document.getElementById('hudDepth'),
            hudTurns: document.getElementById('hudTurns'),
            hudScore: document.getElementById('hudScore'),
            hudLevelBadge: document.getElementById('hudLevelBadge'),
            hpText: document.getElementById('hpText'),
            hpBarFill: document.getElementById('hpBarFill'),
            energyText: document.getElementById('energyText'),
            energyBarFill: document.getElementById('energyBarFill'),
            hudStatAtk: document.getElementById('hudStatAtk'),
            hudStatDef: document.getElementById('hudStatDef'),
            hudStatExp: document.getElementById('hudStatExp'),
            btnTriggerRewind: document.getElementById('btnTriggerRewind'),
            rewindPipsContainer: document.getElementById('rewindPipsContainer'),
            quickslotsContainer: document.getElementById('quickslotsContainer'),
            artifactsContainer: document.getElementById('artifactsContainer'),
            eventLogList: document.getElementById('eventLogList'),
            rewindFxOverlay: document.getElementById('rewindFxOverlay'),
            helpModal: document.getElementById('helpModal'),
            gameOverModal: document.getElementById('gameOverModal'),
            btnToggleSound: document.getElementById('btnToggleSound')
        };

        this.init();
    }

    init() {
        this.setupCanvasDPI();
        this.bindEvents();
        this.startNewGame();
        
        // Start animation/render loop
        requestAnimationFrame((time) => this.renderLoop(time));
    }

    setupCanvasDPI() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        
        this.canvas.width = (rect.width || 800) * dpr;
        this.canvas.height = (rect.height || 600) * dpr;
        this.ctx.scale(dpr, dpr);
    }

    startNewGame() {
        this.depth = 1;
        this.turnCount = 0;
        this.score = 0;
        this.rewindsUsed = 0;
        this.isGameOver = false;
        
        this.player = new Player();
        this.generateLevel();

        this.addLog('✨ Has descendido al estrato 1 de Chronos Abyss. ¡Buena suerte, Crononavegante!', 'chrono');
        this.updateHUD();
    }

    generateLevel() {
        this.map.generate(this.depth);
        
        // Spawn Player in first room center
        const startRoom = this.map.rooms[0];
        this.player.x = startRoom.cx;
        this.player.y = startRoom.cy;

        // Clear existing enemies and items
        this.enemies = [];
        this.items = [];
        this.particles = [];

        // Spawn Enemies in other rooms
        for (let i = 1; i < this.map.rooms.length; i++) {
            const room = this.map.rooms[i];
            const enemyCount = Math.floor(Math.random() * 2) + 1; // 1-2 per room

            for (let e = 0; e < enemyCount; e++) {
                const ex = room.x + Math.floor(Math.random() * (room.w - 2)) + 1;
                const ey = room.y + Math.floor(Math.random() * (room.h - 2)) + 1;

                if (this.map.isWalkable(ex, ey) && !this.getEnemyAt(ex, ey)) {
                    const typeKey = this.chooseEnemyType();
                    this.enemies.push(new Enemy(typeKey, ex, ey, this.depth));
                }
            }

            // Chance of random item on floor
            if (Math.random() < 0.4) {
                const ix = room.x + Math.floor(Math.random() * (room.w - 2)) + 1;
                const iy = room.y + Math.floor(Math.random() * (room.h - 2)) + 1;
                if (this.map.isWalkable(ix, iy)) {
                    const item = window.ItemSpawner.getRandomLoot(this.depth);
                    item.x = ix;
                    item.y = iy;
                    this.items.push(item);
                }
            }
        }

        // Guaranteed Boss on Depth 5
        if (this.depth === 5 && this.map.rooms.length > 1) {
            const bossRoom = this.map.rooms[this.map.rooms.length - 1];
            this.enemies.push(new Enemy('OVERLORD', bossRoom.cx, bossRoom.cy, this.depth));
            this.addLog('⚠️ ¡ALERTA! Presencia del Guardián del Cronos detectada en este estrato.', 'danger');
        }

        // Calculate initial FOV
        this.map.computeFOV(this.player.x, this.player.y, this.player.visionRadius);
    }

    chooseEnemyType() {
        const pool = ['CLOCKWORK'];
        if (this.depth >= 2) pool.push('PHASE_WRAITH');
        if (this.depth >= 3) pool.push('ECHO_STALKER');
        if (this.depth >= 4) pool.push('ANOMALY');
        return pool[Math.floor(Math.random() * pool.length)];
    }

    getEnemyAt(x, y) {
        return this.enemies.find(e => e.x === x && e.y === y && e.hp > 0);
    }

    getItemAt(x, y) {
        return this.items.find(i => i.x === x && i.y === y);
    }

    // === TURN RESOLUTION SYSTEM ===

    handlePlayerAction(dx, dy) {
        if (this.isGameOver) return;

        window.soundEngine.init(); // Initialize audio context on first action

        const targetX = this.player.x + dx;
        const targetY = this.player.y + dy;

        // Check if attacking an enemy
        const enemy = this.getEnemyAt(targetX, targetY);
        if (enemy) {
            this.player.saveSnapshot(this);
            this.performPlayerAttack(enemy);
            this.finalizeTurn();
            return;
        }

        // Check if moving into walkable space
        if (this.map.isWalkable(targetX, targetY)) {
            this.player.saveSnapshot(this);
            this.player.x = targetX;
            this.player.y = targetY;
            window.soundEngine.playStep();

            this.checkTileInteractions();
            this.finalizeTurn();
        }
    }

    performPlayerAttack(enemy) {
        window.soundEngine.playAttack();
        
        let damage = this.player.attack;
        const isCrit = Math.random() < this.player.critChance;
        if (isCrit) {
            damage = Math.round(damage * 1.75);
            this.addParticle(enemy.x, enemy.y, '¡CRÍTICO!', '#fbbf24');
            if (this.player.hasChronoBlade && this.player.energy < this.player.maxEnergy) {
                this.player.energy++;
                this.addLog('Hoja de Entropía restaura +1 Energía Crono.', 'chrono');
            }
        }

        this.addLog(`Atacas a ${enemy.name} por ${damage} de daño.`, 'damage');
        const res = enemy.takeDamage(damage, this);

        if (res.dead) {
            this.score += enemy.exp * 2;
            if (this.player.hasTachyonBoots && Math.random() < 0.35) {
                this.addLog('⚡ ¡Botas de Taquiones te otorgan un turno extra instantáneo!', 'chrono');
                this.addParticle(this.player.x, this.player.y, 'TURNO EXTRA', '#38bdf8');
                return; // Player gets extra turn (skip enemies turn)
            }
        }
    }

    checkTileInteractions() {
        const px = this.player.x;
        const py = this.player.y;
        const currentTile = this.map.tiles[py][px];

        // 1. Pick up items on the floor
        const itemIndex = this.items.findIndex(i => i.x === px && i.y === py);
        if (itemIndex !== -1) {
            const item = this.items[itemIndex];
            const added = this.player.addItem(item, this);
            if (added) {
                this.items.splice(itemIndex, 1);
                this.score += 25;
            }
        }

        // 2. Stairs Down
        if (currentTile === window.TILES.STAIRS_DOWN) {
            window.soundEngine.playStairs();
            this.depth++;
            this.score += 150 * this.depth;
            this.addLog(`🌀 Descendiendo al estrato ${this.depth} del Abismo...`, 'chrono');
            this.generateLevel();
            return;
        }

        // 3. Chrono Rift
        const rift = this.map.rifts.find(r => r.x === px && r.y === py && r.active);
        if (rift) {
            rift.active = false;
            this.map.tiles[py][px] = window.TILES.FLOOR;
            this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 1);
            window.soundEngine.playHeal();
            this.addLog('Absorbiste una Fisura Temporal (+1 Energía Crono).', 'chrono');
            this.addParticle(px, py, '+1 CE', '#38bdf8');
        }

        // 4. Shrine of Chronos
        const shrine = this.map.shrines.find(s => s.x === px && s.y === py && !s.used);
        if (shrine) {
            shrine.used = true;
            this.player.maxHp += 10;
            this.player.hp = this.player.maxHp;
            this.player.attack += 2;
            window.soundEngine.playHeal();
            this.addLog('✨ Altar de Cronos activado: Salud restaurada, +10 Max HP y +2 Ataque.', 'artifact');
            this.addParticle(px, py, '¡BENDICIÓN!', '#fbbf24');
        }

        // 5. Chest
        const chest = this.map.chests.find(c => c.x === px && c.y === py && !c.opened);
        if (chest) {
            chest.opened = true;
            this.map.tiles[py][px] = window.TILES.FLOOR;
            const reward = window.ItemSpawner.getRandomLoot(this.depth);
            this.player.addItem(reward, this);
            this.score += 50;
        }
    }

    finalizeTurn() {
        this.turnCount++;

        // Process enemy turns
        this.enemies.forEach(enemy => {
            if (enemy.hp > 0) {
                enemy.takeTurn(this);
            }
        });

        // Clean dead enemies
        this.enemies = this.enemies.filter(e => e.hp > 0);

        // Update FOV & HUD
        this.map.computeFOV(this.player.x, this.player.y, this.player.visionRadius);
        this.updateHUD();
    }

    // === TEMPORAL REWIND TRIGGER ===

    executeRewind() {
        if (this.isGameOver) return;
        window.soundEngine.init();

        const success = this.player.rewind(this);
        if (success) {
            this.rewindsUsed++;
            this.map.computeFOV(this.player.x, this.player.y, this.player.visionRadius);
            this.updateHUD();
        }
    }

    triggerRewindEffect() {
        this.dom.rewindFxOverlay.classList.remove('active');
        void this.dom.rewindFxOverlay.offsetWidth; // Trigger reflow
        this.dom.rewindFxOverlay.classList.add('active');
        setTimeout(() => {
            this.dom.rewindFxOverlay.classList.remove('active');
        }, 400);
    }

    // === PARTICLES & LOGS ===

    addParticle(tileX, tileY, text, color = '#fff') {
        this.particles.push({
            x: tileX * this.tileSize + this.tileSize / 2,
            y: tileY * this.tileSize,
            text: text,
            color: color,
            alpha: 1,
            vy: -1.2,
            life: 45
        });
    }

    addLog(message, type = 'normal') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        this.dom.eventLogList.appendChild(entry);
        this.dom.eventLogList.scrollTop = this.dom.eventLogList.scrollHeight;

        // Keep last 40 logs
        while (this.dom.eventLogList.children.length > 40) {
            this.dom.eventLogList.removeChild(this.dom.eventLogList.firstChild);
        }
    }

    // === UI BINDING & HUD ===

    updateHUD() {
        this.dom.hudDepth.textContent = this.depth;
        this.dom.hudTurns.textContent = this.turnCount;
        this.dom.hudScore.textContent = this.score;
        this.dom.hudLevelBadge.textContent = `Nv. ${this.player.level}`;

        // Health Bar
        const hpPercent = Math.max(0, Math.min(100, (this.player.hp / this.player.maxHp) * 100));
        this.dom.hpText.textContent = `${this.player.hp} / ${this.player.maxHp}`;
        this.dom.hpBarFill.style.width = `${hpPercent}%`;

        // Energy Bar
        const energyPercent = Math.max(0, Math.min(100, (this.player.energy / this.player.maxEnergy) * 100));
        this.dom.energyText.textContent = `${this.player.energy} / ${this.player.maxEnergy}`;
        this.dom.energyBarFill.style.width = `${energyPercent}%`;

        // Stats
        this.dom.hudStatAtk.textContent = this.player.attack;
        this.dom.hudStatDef.textContent = this.player.defense;
        this.dom.hudStatExp.textContent = `${this.player.exp}/${this.player.nextLevelExp}`;

        // Rewind Button & Pips
        this.dom.btnTriggerRewind.disabled = this.player.energy <= 0 || this.player.history.length === 0;
        this.dom.rewindPipsContainer.innerHTML = '';
        for (let i = 0; i < this.player.maxEnergy; i++) {
            const pip = document.createElement('div');
            pip.className = `charge-pip ${i < this.player.energy ? 'active' : ''}`;
            this.dom.rewindPipsContainer.appendChild(pip);
        }

        // Quickslots
        this.dom.quickslotsContainer.innerHTML = '';
        for (let i = 0; i < 3; i++) {
            const item = this.player.inventory[i];
            const slot = document.createElement('div');
            if (item) {
                slot.className = 'quickslot-item';
                slot.innerHTML = `
                    <span class="quickslot-key">${i + 1}</span>
                    <span class="quickslot-icon">${item.icon}</span>
                    <span class="quickslot-name" title="${item.description}">${item.name}</span>
                `;
                slot.onclick = () => {
                    this.player.useConsumable(i, this);
                    this.finalizeTurn();
                };
            } else {
                slot.className = 'quickslot-item empty';
                slot.innerHTML = `<span class="quickslot-key">${i + 1}</span><span class="quickslot-name">-</span>`;
            }
            this.dom.quickslotsContainer.appendChild(slot);
        }

        // Passive Artifacts
        if (this.player.artifacts.length === 0) {
            this.dom.artifactsContainer.innerHTML = '<span style="font-size: 0.75rem; color: var(--text-muted);">Sin artefactos encontrados aún.</span>';
        } else {
            this.dom.artifactsContainer.innerHTML = '';
            this.player.artifacts.forEach(art => {
                const badge = document.createElement('div');
                badge.className = 'artifact-badge';
                badge.title = `${art.name}: ${art.description}`;
                badge.innerHTML = `<span>${art.icon}</span> <span>${art.name}</span>`;
                this.dom.artifactsContainer.appendChild(badge);
            });
        }
    }

    onGameOver() {
        this.isGameOver = true;
        window.soundEngine.playGameOver();

        document.getElementById('endDepth').textContent = this.depth;
        document.getElementById('endTurns').textContent = this.turnCount;
        document.getElementById('endScore').textContent = this.score;
        document.getElementById('endRewinds').textContent = this.rewindsUsed;

        this.dom.gameOverModal.classList.add('active');

        // Save High Score
        const savedScore = parseInt(localStorage.getItem('chronos_high_score') || '0', 10);
        if (this.score > savedScore) {
            localStorage.setItem('chronos_high_score', this.score.toString());
        }
    }

    // === CANVAS RENDERING LOOP ===

    renderLoop(timestamp) {
        this.update(timestamp);
        this.draw();
        requestAnimationFrame((time) => this.renderLoop(time));
    }

    update(timestamp) {
        // Smooth camera follow on player
        const targetCamX = this.player.x * this.tileSize - (this.canvas.width / (window.devicePixelRatio || 1)) / 2 + this.tileSize / 2;
        const targetCamY = this.player.y * this.tileSize - (this.canvas.height / (window.devicePixelRatio || 1)) / 2 + this.tileSize / 2;

        this.camera.x += (targetCamX - this.camera.x) * 0.15;
        this.camera.y += (targetCamY - this.camera.y) * 0.15;

        // Update floating particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.y += p.vy;
            p.life--;
            p.alpha = Math.max(0, p.life / 45);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;

        this.ctx.save();
        this.ctx.clearRect(0, 0, width, height);

        // Fill background abyss
        this.ctx.fillStyle = '#06030e';
        this.ctx.fillRect(0, 0, width, height);

        // Apply camera translation
        this.ctx.translate(-Math.round(this.camera.x), -Math.round(this.camera.y));

        // 1. Draw Map Tiles
        for (let y = 0; y < this.map.height; y++) {
            for (let x = 0; x < this.map.width; x++) {
                const isVisible = this.map.isVisible(x, y);
                const isExplored = this.map.isExplored(x, y);

                if (!isExplored) continue;

                const tile = this.map.tiles[y][x];
                const drawX = x * this.tileSize;
                const drawY = y * this.tileSize;

                // Base Tile Rendering
                if (tile === window.TILES.WALL) {
                    this.ctx.fillStyle = isVisible ? '#1f1338' : '#0f091c';
                    this.ctx.fillRect(drawX, drawY, this.tileSize, this.tileSize);
                    this.ctx.strokeStyle = isVisible ? '#3b216b' : '#180e2e';
                    this.ctx.strokeRect(drawX, drawY, this.tileSize, this.tileSize);
                } else {
                    // Floor
                    this.ctx.fillStyle = isVisible ? '#0d081d' : '#07040e';
                    this.ctx.fillRect(drawX, drawY, this.tileSize, this.tileSize);
                    this.ctx.strokeStyle = isVisible ? '#1a1038' : '#0b0618';
                    this.ctx.strokeRect(drawX, drawY, this.tileSize, this.tileSize);
                }

                // Interactive Special Tiles
                if (isVisible) {
                    if (tile === window.TILES.STAIRS_DOWN) {
                        this.ctx.font = '18px sans-serif';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText('🌀', drawX + this.tileSize / 2, drawY + this.tileSize / 2);
                    } else if (tile === window.TILES.CHRONO_RIFT) {
                        this.ctx.font = '16px sans-serif';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText('⚡', drawX + this.tileSize / 2, drawY + this.tileSize / 2);
                    } else if (tile === window.TILES.SHRINE) {
                        this.ctx.font = '16px sans-serif';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText('⛩️', drawX + this.tileSize / 2, drawY + this.tileSize / 2);
                    } else if (tile === window.TILES.CHEST) {
                        this.ctx.font = '16px sans-serif';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText('📦', drawX + this.tileSize / 2, drawY + this.tileSize / 2);
                    }
                }
            }
        }

        // 2. Draw Items on Floor
        this.items.forEach(item => {
            if (this.map.isVisible(item.x, item.y)) {
                this.ctx.font = '16px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(item.icon, item.x * this.tileSize + this.tileSize / 2, item.y * this.tileSize + this.tileSize / 2);
            }
        });

        // 3. Draw Enemies
        this.enemies.forEach(enemy => {
            if (enemy.hp > 0 && this.map.isVisible(enemy.x, enemy.y)) {
                const ex = enemy.x * this.tileSize + this.tileSize / 2;
                const ey = enemy.y * this.tileSize + this.tileSize / 2;

                // Enemy sprite/icon
                this.ctx.font = '20px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(enemy.char, ex, ey);

                // Small HP bar above enemy
                const barWidth = 24;
                const barHeight = 4;
                const hpPct = Math.max(0, enemy.hp / enemy.maxHp);
                this.ctx.fillStyle = 'rgba(0,0,0,0.6)';
                this.ctx.fillRect(ex - barWidth / 2, ey - 18, barWidth, barHeight);
                this.ctx.fillStyle = enemy.color;
                this.ctx.fillRect(ex - barWidth / 2, ey - 18, barWidth * hpPct, barHeight);
            }
        });

        // 4. Draw Player
        const px = this.player.x * this.tileSize + this.tileSize / 2;
        const py = this.player.y * this.tileSize + this.tileSize / 2;

        // Player Aura / Glow
        const gradient = this.ctx.createRadialGradient(px, py, 4, px, py, 24);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.4)');
        gradient.addColorStop(1, 'transparent');
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(px, py, 24, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.font = '22px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(this.player.char, px, py);

        // 5. Draw Floating Damage Numbers & Combat Particles
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.font = 'bold 12px Orbitron, sans-serif';
            this.ctx.fillStyle = p.color;
            this.ctx.textAlign = 'center';
            this.ctx.shadowColor = '#000';
            this.ctx.shadowBlur = 4;
            this.ctx.fillText(p.text, p.x, p.y);
            this.ctx.restore();
        });

        this.ctx.restore();
    }

    // === EVENT LISTENERS & BINDINGS ===

    bindEvents() {
        // Keyboard controls
        window.addEventListener('keydown', (e) => {
            if (this.isGameOver) return;

            switch (e.key.toLowerCase()) {
                case 'w':
                case 'arrowup':
                    e.preventDefault();
                    this.handlePlayerAction(0, -1);
                    break;
                case 's':
                case 'arrowdown':
                    e.preventDefault();
                    this.handlePlayerAction(0, 1);
                    break;
                case 'a':
                case 'arrowleft':
                    e.preventDefault();
                    this.handlePlayerAction(-1, 0);
                    break;
                case 'd':
                case 'arrowright':
                    e.preventDefault();
                    this.handlePlayerAction(1, 0);
                    break;
                case ' ':
                    // Wait Turn
                    e.preventDefault();
                    this.player.saveSnapshot(this);
                    this.addLog('Esperas un instante observando los flujos temporales...', 'normal');
                    this.finalizeTurn();
                    break;
                case 'r':
                    // Trigger Rewind
                    e.preventDefault();
                    this.executeRewind();
                    break;
                case '1':
                    this.player.useConsumable(0, this);
                    this.finalizeTurn();
                    break;
                case '2':
                    this.player.useConsumable(1, this);
                    this.finalizeTurn();
                    break;
                case '3':
                    this.player.useConsumable(2, this);
                    this.finalizeTurn();
                    break;
                case 'm':
                    const isMuted = window.soundEngine.toggleMute();
                    this.dom.btnToggleSound.textContent = isMuted ? '🔇' : '🔊';
                    break;
                case 'h':
                    this.dom.helpModal.classList.toggle('active');
                    break;
            }
        });

        // Rewind Button Click
        this.dom.btnTriggerRewind.addEventListener('click', () => this.executeRewind());

        // Header Action Buttons
        this.dom.btnToggleSound.addEventListener('click', () => {
            const isMuted = window.soundEngine.toggleMute();
            this.dom.btnToggleSound.textContent = isMuted ? '🔇' : '🔊';
        });

        this.dom.btnOpenHelp.addEventListener('click', () => {
            this.dom.helpModal.classList.add('active');
        });

        document.getElementById('btnCloseHelp').addEventListener('click', () => {
            this.dom.helpModal.classList.remove('active');
        });

        document.getElementById('btnRestartGame').addEventListener('click', () => {
            this.startNewGame();
        });

        document.getElementById('btnRestartAfterDeath').addEventListener('click', () => {
            this.dom.gameOverModal.classList.remove('active');
            this.startNewGame();
        });

        // Mobile D-Pad Buttons
        document.getElementById('btnDpadUp').addEventListener('click', () => this.handlePlayerAction(0, -1));
        document.getElementById('btnDpadDown').addEventListener('click', () => this.handlePlayerAction(0, 1));
        document.getElementById('btnDpadLeft').addEventListener('click', () => this.handlePlayerAction(-1, 0));
        document.getElementById('btnDpadRight').addEventListener('click', () => this.handlePlayerAction(1, 0));
        document.getElementById('btnDpadWait').addEventListener('click', () => {
            this.player.saveSnapshot(this);
            this.addLog('Esperas un turno...', 'normal');
            this.finalizeTurn();
        });

        // Resize Listener
        window.addEventListener('resize', () => {
            this.setupCanvasDPI();
        });
    }
}

// Instantiate engine when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.gameEngine = new GameEngine();
});

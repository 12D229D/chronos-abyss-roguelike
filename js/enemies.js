/**
 * Chronos Abyss - Enemy System & Turn AI
 * Defines time-distorted enemy archetypes and procedural behavioral AI.
 */

const ENEMY_TYPES = {
    CLOCKWORK: {
        name: 'Relojero Errante',
        char: '⚙️',
        baseHp: 18,
        attack: 5,
        defense: 1,
        color: '#f59e0b',
        exp: 15,
        behavior: 'stalker',
        description: 'Autómata atrapado en un ciclo mecánico. Te persigue de forma implacable.'
    },
    PHASE_WRAITH: {
        name: 'Espectro de Fase',
        char: '👻',
        baseHp: 14,
        attack: 7,
        defense: 0,
        color: '#a855f7',
        exp: 25,
        behavior: 'phase',
        description: 'Entidad cuántica que puede teleportarse o atravesar fisuras temporales.'
    },
    ECHO_STALKER: {
        name: 'Sombra del Pasado',
        char: '👤',
        baseHp: 24,
        attack: 8,
        defense: 2,
        color: '#06b6d4',
        exp: 35,
        behavior: 'echo',
        description: 'Eco de un crononavegante caído. Veloz y ataca con furia temporal.'
    },
    ANOMALY: {
        name: 'Anomalía Temporal',
        char: '🌀',
        baseHp: 20,
        attack: 9,
        defense: 1,
        color: '#ec4899',
        exp: 40,
        behavior: 'explosive',
        description: 'Ruptura en el tejido dimensional. Al morir explota liberando metralla cuántica.'
    },
    OVERLORD: {
        name: 'Guardián del Cronos',
        char: '👁️',
        baseHp: 65,
        attack: 13,
        defense: 4,
        color: '#e11d48',
        exp: 100,
        behavior: 'boss',
        description: 'Jefe del estrato abisal. Lanza pulsos cronológicos devastadores a distancia.'
    }
};

class Enemy {
    constructor(typeKey, x, y, depth = 1) {
        const type = ENEMY_TYPES[typeKey];
        this.typeKey = typeKey;
        this.name = type.name;
        this.char = type.char;
        this.color = type.color;
        this.behavior = type.behavior;
        this.exp = Math.floor(type.exp * (1 + depth * 0.2));
        
        // Scaled stats
        const scale = 1 + (depth - 1) * 0.25;
        this.maxHp = Math.round(type.baseHp * scale);
        this.hp = this.maxHp;
        this.attack = Math.round(type.attack * scale);
        this.defense = Math.round(type.defense + Math.floor(depth / 2));
        
        this.x = x;
        this.y = y;
        this.stunnedTurns = 0;
        this.teleportCooldown = 3;
        this.attackCooldown = 0;
    }

    takeDamage(amount, gameState) {
        const actualDamage = Math.max(1, amount - this.defense);
        this.hp -= actualDamage;
        gameState.addParticle(this.x, this.y, `-${actualDamage}`, '#ef4444');
        
        if (this.hp <= 0) {
            this.onDeath(gameState);
            return { dead: true, damage: actualDamage };
        }
        return { dead: false, damage: actualDamage };
    }

    onDeath(gameState) {
        gameState.addLog(`¡Derrotaste a ${this.name}! (+${this.exp} EXP)`, 'defeat');
        gameState.player.gainExp(this.exp, gameState);
        
        // Special death effect for explosive anomaly
        if (this.behavior === 'explosive') {
            gameState.addLog('¡La Anomalía colapsa en una onda expansiva cuántica!', 'danger');
            // Deal damage to adjacent tiles
            const neighbors = [
                {x: this.x + 1, y: this.y}, {x: this.x - 1, y: this.y},
                {x: this.x, y: this.y + 1}, {x: this.x, y: this.y - 1},
                {x: this.x + 1, y: this.y + 1}, {x: this.x - 1, y: this.y - 1}
            ];
            neighbors.forEach(n => {
                if (gameState.player.x === n.x && gameState.player.y === n.y) {
                    const dmg = 8;
                    gameState.player.takeDamage(dmg, gameState, 'Onda de Anomalía');
                }
            });
        }

        // Chance to drop loot on death
        if (Math.random() < 0.35) {
            const drop = window.ItemSpawner.getRandomLoot(gameState.depth);
            drop.x = this.x;
            drop.y = this.y;
            gameState.items.push(drop);
            gameState.addLog(`${this.name} dejó caer: ${drop.name}`, 'item');
        }
    }

    takeTurn(gameState) {
        if (this.hp <= 0) return;

        // Check if stunned
        if (this.stunnedTurns > 0) {
            this.stunnedTurns--;
            gameState.addParticle(this.x, this.y, '💤', '#c084fc');
            return;
        }

        const player = gameState.player;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);

        // Can only act if awake / player in detection radius
        const isVisible = gameState.map.isVisible(this.x, this.y);
        if (!isVisible && dist > 7) {
            return; // Inactive in the dark far away
        }

        // Boss ranged attack
        if (this.behavior === 'boss' && dist <= 4 && dist > 1) {
            if (this.attackCooldown <= 0) {
                gameState.addLog(`¡${this.name} canaliza un Pulso de Entropía!`, 'danger');
                player.takeDamage(this.attack + 2, gameState, this.name);
                gameState.addParticle(player.x, player.y, '💥 PULSO', '#e11d48');
                this.attackCooldown = 3;
                return;
            } else {
                this.attackCooldown--;
            }
        }

        // Phase Wraith teleport ability
        if (this.behavior === 'phase' && dist > 2 && dist <= 6) {
            this.teleportCooldown--;
            if (this.teleportCooldown <= 0) {
                // Teleport closer to player
                const candidates = [
                    {x: player.x + 1, y: player.y}, {x: player.x - 1, y: player.y},
                    {x: player.x, y: player.y + 1}, {x: player.x, y: player.y - 1}
                ].filter(c => gameState.map.isWalkable(c.x, c.y) && !gameState.getEnemyAt(c.x, c.y));
                
                if (candidates.length > 0) {
                    const dest = candidates[Math.floor(Math.random() * candidates.length)];
                    this.x = dest.x;
                    this.y = dest.y;
                    this.teleportCooldown = 4;
                    gameState.addParticle(this.x, this.y, '✨ FASE', '#a855f7');
                    gameState.addLog(`¡El ${this.name} se desmaterializa y reaparece a tu lado!`, 'warning');
                    return;
                }
            }
        }

        // If directly adjacent to player, attack!
        if (dist <= 1.5) {
            this.attackPlayer(player, gameState);
            return;
        }

        // Move towards player
        this.stepTowards(player.x, player.y, gameState);
    }

    attackPlayer(player, gameState) {
        player.takeDamage(this.attack, gameState, this.name);
    }

    stepTowards(targetX, targetY, gameState) {
        const dx = Math.sign(targetX - this.x);
        const dy = Math.sign(targetY - this.y);

        // Try primary axis first
        let newX = this.x + dx;
        let newY = this.y;

        const canMove = (x, y) => {
            return gameState.map.isWalkable(x, y) && 
                   !gameState.getEnemyAt(x, y) && 
                   !(gameState.player.x === x && gameState.player.y === y);
        };

        if (dx !== 0 && canMove(newX, newY)) {
            this.x = newX;
            return;
        }

        newX = this.x;
        newY = this.y + dy;
        if (dy !== 0 && canMove(newX, newY)) {
            this.y = newY;
            return;
        }

        // Try diagonal if straight is blocked
        if (dx !== 0 && dy !== 0 && canMove(this.x + dx, this.y + dy)) {
            this.x += dx;
            this.y += dy;
        }
    }

    clone() {
        const copy = new Enemy(this.typeKey, this.x, this.y);
        copy.hp = this.hp;
        copy.maxHp = this.maxHp;
        copy.attack = this.attack;
        copy.defense = this.defense;
        copy.stunnedTurns = this.stunnedTurns;
        copy.teleportCooldown = this.teleportCooldown;
        copy.attackCooldown = this.attackCooldown;
        return copy;
    }
}

window.ENEMY_TYPES = ENEMY_TYPES;
window.Enemy = Enemy;

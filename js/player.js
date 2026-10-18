/**
 * Chronos Abyss - Player Class & Temporal Rewind Engine
 * Manages player stats, inventory, active artifacts, and the turn history snapshot stack.
 */

class Player {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        this.char = '⏳';
        
        // Base stats
        this.level = 1;
        this.exp = 0;
        this.nextLevelExp = 50;
        
        this.maxHp = 60;
        this.hp = 60;
        
        this.maxEnergy = 3; // Chrono energy points for rewind
        this.energy = 3;
        
        this.attack = 10;
        this.defense = 2;
        this.critChance = 0.15;
        this.dodgeChance = 0.05;
        this.visionRadius = 6;
        
        // Items and passives
        this.inventory = [];
        this.maxInventorySize = 5;
        this.artifacts = [];
        
        // Rewind system
        this.maxUndoTurns = 3;
        this.history = []; // Array of TurnSnapshots
        
        // Special perks
        this.hasChronoBlade = false;
        this.hasTachyonBoots = false;
    }

    takeDamage(rawDamage, gameState, sourceName = 'Enemigo') {
        // Check dodge
        if (Math.random() < this.dodgeChance) {
            gameState.addLog(`¡Distorsión de fase! Esquivaste el ataque de ${sourceName}.`, 'dodge');
            gameState.addParticle(this.x, this.y, '¡ESQUIVADO!', '#38bdf8');
            return 0;
        }

        const damage = Math.max(1, rawDamage - this.defense);
        this.hp -= damage;
        window.soundEngine.playHit();
        gameState.addLog(`Recibes ${damage} de daño de ${sourceName}.`, 'damage');
        gameState.addParticle(this.x, this.y, `-${damage} HP`, '#ef4444');

        if (this.hp <= 0) {
            this.hp = 0;
            gameState.onGameOver();
        }
        return damage;
    }

    gainExp(amount, gameState) {
        this.exp += amount;
        if (this.exp >= this.nextLevelExp) {
            this.levelUp(gameState);
        }
    }

    levelUp(gameState) {
        this.level++;
        this.exp -= this.nextLevelExp;
        this.nextLevelExp = Math.round(this.nextLevelExp * 1.5);
        
        this.maxHp += 15;
        this.hp = this.maxHp;
        this.attack += 3;
        this.defense += 1;
        this.maxEnergy = Math.min(6, this.maxEnergy + 1);
        this.energy = this.maxEnergy;

        window.soundEngine.playHeal();
        gameState.addLog(`⚡ ¡NIVEL ${this.level}! Salud restaurada y estadísticas aumentadas.`, 'levelup');
        gameState.addParticle(this.x, this.y, `¡NIVEL ${this.level}!`, '#fbbf24');
    }

    addItem(item, gameState) {
        if (item.type === window.ITEM_TYPES.ARTIFACT) {
            // Equip artifact immediately
            this.artifacts.push(item);
            if (item.onEquip) item.onEquip(this);
            window.soundEngine.playPickup();
            gameState.addLog(`✨ Artefacto equipado: ${item.name} (${item.description})`, 'artifact');
            gameState.addParticle(this.x, this.y, item.icon, '#fbbf24');
            return true;
        }

        if (this.inventory.length >= this.maxInventorySize) {
            gameState.addLog('Tu cinturón de consumibles está lleno.', 'warning');
            return false;
        }

        this.inventory.push(item);
        window.soundEngine.playPickup();
        gameState.addLog(`Recogiste: ${item.name}`, 'item');
        gameState.addParticle(this.x, this.y, item.icon, '#10b981');
        return true;
    }

    useConsumable(index, gameState) {
        if (index < 0 || index >= this.inventory.length) return false;
        const item = this.inventory[index];
        if (item && item.use) {
            const success = item.use(this, gameState);
            if (success) {
                this.inventory.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    // === TEMPORAL REWIND ENGINE ===

    /**
     * Captures an immutable snapshot of current game state prior to an action
     */
    saveSnapshot(gameState) {
        const snapshot = {
            player: {
                x: this.x,
                y: this.y,
                hp: this.hp,
                maxHp: this.maxHp,
                energy: this.energy,
                level: this.level,
                exp: this.exp,
                attack: this.attack,
                defense: this.defense,
                inventory: this.inventory.map(i => i.clone()),
                artifacts: this.artifacts.map(a => a.clone())
            },
            enemies: gameState.enemies.map(e => e.clone()),
            items: gameState.items.map(i => i.clone()),
            turnCount: gameState.turnCount,
            score: gameState.score,
            message: `Turno ${gameState.turnCount}`
        };

        this.history.push(snapshot);
        if (this.history.length > this.maxUndoTurns) {
            this.history.shift(); // Keep only the latest maxUndoTurns
        }
    }

    /**
     * Executes the Temporal Rewind
     */
    rewind(gameState) {
        if (this.history.length === 0) {
            gameState.addLog('No hay ecos temporales disponibles para rebobinar.', 'warning');
            return false;
        }

        if (this.energy <= 0) {
            gameState.addLog('Energía Crono insuficiente (requiere al menos 1 CE).', 'warning');
            return false;
        }

        // Pop last snapshot
        const previousState = this.history.pop();
        if (!previousState) return false;

        // Restore Player
        this.x = previousState.player.x;
        this.y = previousState.player.y;
        this.hp = previousState.player.hp;
        this.maxHp = previousState.player.maxHp;
        this.energy = Math.max(0, previousState.player.energy - 1); // Deduct 1 energy cost for rewinding!
        this.level = previousState.player.level;
        this.exp = previousState.player.exp;
        this.attack = previousState.player.attack;
        this.defense = previousState.player.defense;
        this.inventory = previousState.player.inventory;
        this.artifacts = previousState.player.artifacts;

        // Restore Entities
        gameState.enemies = previousState.enemies;
        gameState.items = previousState.items;
        gameState.turnCount = previousState.turnCount;
        gameState.score = previousState.score;

        // Visual & Audio effects
        window.soundEngine.playRewind();
        gameState.triggerRewindEffect();
        gameState.addLog(`🌀 ¡REBOBINADO TEMPORAL ACTIVADO! Regresas al ${previousState.message}.`, 'chrono');
        gameState.addParticle(this.x, this.y, '⏪ REBOBINADO', '#38bdf8');
        
        return true;
    }
}

window.Player = Player;

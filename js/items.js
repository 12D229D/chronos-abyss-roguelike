/**
 * Chronos Abyss - Items & Synergy System
 * Defines passive artifacts, usable consumables, and synergy perks.
 */

const ITEM_TYPES = {
    CONSUMABLE: 'consumable',
    ARTIFACT: 'artifact'
};

const ITEMS_CATALOG = {
    // === CONSUMABLES ===
    potion_heal: {
        id: 'potion_heal',
        name: 'Cápsula de Estasis',
        type: ITEM_TYPES.CONSUMABLE,
        icon: '🧪',
        description: 'Restaura 35 puntos de Salud (HP).',
        color: '#10b981',
        use(player, gameState) {
            const healed = Math.min(35, player.maxHp - player.hp);
            if (healed <= 0) {
                gameState.addLog('Tu salud ya está al máximo.', 'warning');
                return false;
            }
            player.hp += healed;
            window.soundEngine.playHeal();
            gameState.addLog(`Usaste Cápsula de Estasis. Recuperaste +${healed} HP.`, 'heal');
            gameState.addParticle(player.x, player.y, `+${healed} HP`, '#10b981');
            return true;
        }
    },
    potion_energy: {
        id: 'potion_energy',
        name: 'Célula de Cronos',
        type: ITEM_TYPES.CONSUMABLE,
        icon: '⚡',
        description: 'Recarga +2 de Energía Crono (CE) para rebobinar el tiempo.',
        color: '#38bdf8',
        use(player, gameState) {
            if (player.energy >= player.maxEnergy) {
                gameState.addLog('Tu Energía Crono ya está saturada.', 'warning');
                return false;
            }
            player.energy = Math.min(player.maxEnergy, player.energy + 2);
            window.soundEngine.playHeal();
            gameState.addLog('Activaste Célula de Cronos (+2 Energía Crono).', 'chrono');
            gameState.addParticle(player.x, player.y, '+2 CE', '#38bdf8');
            return true;
        }
    },
    bomb_paradox: {
        id: 'bomb_paradox',
        name: 'Granada de Paradoja',
        type: ITEM_TYPES.CONSUMABLE,
        icon: '🔮',
        description: 'Congela y aturde a todos los enemigos visibles durante 2 turnos.',
        color: '#c084fc',
        use(player, gameState) {
            let frozenCount = 0;
            gameState.enemies.forEach(enemy => {
                if (gameState.map.isVisible(enemy.x, enemy.y)) {
                    enemy.stunnedTurns = (enemy.stunnedTurns || 0) + 2;
                    gameState.addParticle(enemy.x, enemy.y, '¡CONGELADO!', '#c084fc');
                    frozenCount++;
                }
            });
            window.soundEngine.playRewind();
            gameState.addLog(`¡Granada de Paradoja detonada! ${frozenCount} anomalías atrapadas en estasis.`, 'chrono');
            return true;
        }
    },

    // === PASSIVE ARTIFACTS ===
    artifact_lens: {
        id: 'artifact_lens',
        name: 'Lente de Precognición',
        type: ITEM_TYPES.ARTIFACT,
        icon: '🧿',
        rarity: 'rare',
        description: 'Aumenta el radio de visión (+2 casillas) y revela cofres ocultos.',
        onEquip(player) {
            player.visionRadius += 2;
        }
    },
    artifact_quantum_clock: {
        id: 'artifact_quantum_clock',
        name: 'Reloj de Arena Cuántico',
        type: ITEM_TYPES.ARTIFACT,
        icon: '⏳',
        rarity: 'legendary',
        description: 'Aumenta la capacidad máxima de rebobinado de 3 a 5 turnos.',
        onEquip(player) {
            player.maxUndoTurns = 5;
            player.maxEnergy += 2;
            player.energy += 2;
        }
    },
    artifact_phase_cloak: {
        id: 'artifact_phase_cloak',
        name: 'Manto de Fase',
        type: ITEM_TYPES.ARTIFACT,
        icon: '✨',
        rarity: 'epic',
        description: 'Otorga un 25% de probabilidad de esquivar ataques enemigos por distorsión.',
        onEquip(player) {
            player.dodgeChance = (player.dodgeChance || 0) + 0.25;
        }
    },
    artifact_chrono_blade: {
        id: 'artifact_chrono_blade',
        name: 'Hoja de Entropía',
        type: ITEM_TYPES.ARTIFACT,
        icon: '🗡️',
        rarity: 'rare',
        description: '+4 de daño de ataque base. Cada golpe crítico recupera 1 Energía Crono.',
        onEquip(player) {
            player.attack += 4;
            player.hasChronoBlade = true;
        }
    },
    artifact_tachyon_boots: {
        id: 'artifact_tachyon_boots',
        name: 'Botas de Taquiones',
        type: ITEM_TYPES.ARTIFACT,
        icon: '🥾',
        rarity: 'epic',
        description: 'Al matar un enemigo, obtienes un 35% de probabilidad de ganar un turno extra inmediato.',
        onEquip(player) {
            player.hasTachyonBoots = true;
        }
    }
};

class Item {
    constructor(templateKey, x = 0, y = 0) {
        const template = ITEMS_CATALOG[templateKey];
        if (!template) {
            throw new Error(`Item template "${templateKey}" no existe.`);
        }
        this.templateKey = templateKey;
        this.id = template.id;
        this.name = template.name;
        this.type = template.type;
        this.icon = template.icon;
        this.description = template.description;
        this.color = template.color || '#f59e0b';
        this.rarity = template.rarity || 'common';
        this.x = x;
        this.y = y;
        this.use = template.use || null;
        this.onEquip = template.onEquip || null;
    }

    clone() {
        const copy = new Item(this.templateKey, this.x, this.y);
        return copy;
    }
}

// Helpers for procedural loot generation
const ItemSpawner = {
    getRandomLoot(depth = 1) {
        const roll = Math.random();
        if (roll < 0.65) {
            // Consumable
            const pool = ['potion_heal', 'potion_energy', 'bomb_paradox'];
            const choice = pool[Math.floor(Math.random() * pool.length)];
            return new Item(choice);
        } else {
            // Artifact
            const pool = ['artifact_lens', 'artifact_quantum_clock', 'artifact_phase_cloak', 'artifact_chrono_blade', 'artifact_tachyon_boots'];
            const choice = pool[Math.floor(Math.random() * pool.length)];
            return new Item(choice);
        }
    }
};

window.ITEMS_CATALOG = ITEMS_CATALOG;
window.Item = Item;
window.ItemSpawner = ItemSpawner;

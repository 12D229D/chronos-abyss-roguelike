/**
 * Chronos Abyss - Procedural Dungeon Generator & Fog of War
 * Generates room layouts, corridors, interactive tiles, and computes line-of-sight.
 */

const TILES = {
    VOID: 0,
    FLOOR: 1,
    WALL: 2,
    STAIRS_DOWN: 3,
    CHRONO_RIFT: 4,     // Restores energy or creates risk
    SHRINE: 5,          // Interactive shrine that enhances stats
    CHEST: 6            // Chest containing guaranteed artifact/loot
};

class GameMap {
    constructor(width = 40, height = 30) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.explored = [];
        this.visible = [];
        this.rooms = [];
        this.stairsLocation = { x: 0, y: 0 };
        this.shrines = [];
        this.rifts = [];
        this.chests = [];
        
        this.initGrid();
    }

    initGrid() {
        this.tiles = Array.from({ length: this.height }, () => Array(this.width).fill(TILES.WALL));
        this.explored = Array.from({ length: this.height }, () => Array(this.width).fill(false));
        this.visible = Array.from({ length: this.height }, () => Array(this.width).fill(false));
        this.rooms = [];
        this.shrines = [];
        this.rifts = [];
        this.chests = [];
    }

    generate(depth = 1) {
        this.initGrid();

        const minSize = 5;
        const maxSize = 10;
        const maxRooms = 8 + Math.min(6, depth * 2);

        for (let r = 0; r < maxRooms; r++) {
            const w = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            const h = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
            const x = Math.floor(Math.random() * (this.width - w - 2)) + 1;
            const y = Math.floor(Math.random() * (this.height - h - 2)) + 1;

            const newRoom = { x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) };

            // Check overlap
            let failed = false;
            for (const other of this.rooms) {
                if (
                    newRoom.x <= other.x + other.w + 1 &&
                    newRoom.x + newRoom.w + 1 >= other.x &&
                    newRoom.y <= other.y + other.h + 1 &&
                    newRoom.y + newRoom.h + 1 >= other.y
                ) {
                    failed = true;
                    break;
                }
            }

            if (!failed) {
                this.carveRoom(newRoom);

                if (this.rooms.length > 0) {
                    const prev = this.rooms[this.rooms.length - 1];
                    this.carveCorridor(prev.cx, prev.cy, newRoom.cx, newRoom.cy);
                }

                this.rooms.push(newRoom);
            }
        }

        // Place stairs in the furthest room
        if (this.rooms.length > 1) {
            const startRoom = this.rooms[0];
            const endRoom = this.rooms[this.rooms.length - 1];
            this.stairsLocation = { x: endRoom.cx, y: endRoom.cy };
            this.tiles[endRoom.cy][endRoom.cx] = TILES.STAIRS_DOWN;
        }

        // Place interactive special tiles in intermediate rooms
        for (let i = 1; i < this.rooms.length - 1; i++) {
            const room = this.rooms[i];
            
            // Chance of Chrono Rift
            if (Math.random() < 0.5) {
                const rx = room.x + Math.floor(Math.random() * (room.w - 2)) + 1;
                const ry = room.y + Math.floor(Math.random() * (room.h - 2)) + 1;
                if (this.tiles[ry][rx] === TILES.FLOOR) {
                    this.tiles[ry][rx] = TILES.CHRONO_RIFT;
                    this.rifts.push({ x: rx, y: ry, active: true });
                }
            }

            // Chance of Shrine of Chronos
            if (Math.random() < 0.35) {
                const sx = room.x + Math.floor(Math.random() * (room.w - 2)) + 1;
                const sy = room.y + Math.floor(Math.random() * (room.h - 2)) + 1;
                if (this.tiles[sy][sx] === TILES.FLOOR) {
                    this.tiles[sy][sx] = TILES.SHRINE;
                    this.shrines.push({ x: sx, y: sy, used: false });
                }
            }

            // Chance of Chest
            if (Math.random() < 0.45) {
                const cx = room.x + Math.floor(Math.random() * (room.w - 2)) + 1;
                const cy = room.y + Math.floor(Math.random() * (room.h - 2)) + 1;
                if (this.tiles[cy][cx] === TILES.FLOOR) {
                    this.tiles[cy][cx] = TILES.CHEST;
                    this.chests.push({ x: cx, y: cy, opened: false });
                }
            }
        }
    }

    carveRoom(room) {
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                this.tiles[y][x] = TILES.FLOOR;
            }
        }
    }

    carveCorridor(x1, y1, x2, y2) {
        let x = x1;
        let y = y1;

        while (x !== x2) {
            this.tiles[y][x] = TILES.FLOOR;
            x += Math.sign(x2 - x);
        }
        while (y !== y2) {
            this.tiles[y][x] = TILES.FLOOR;
            y += Math.sign(y2 - y);
        }
        this.tiles[y][x] = TILES.FLOOR;
    }

    isWalkable(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        const tile = this.tiles[y][x];
        return tile !== TILES.WALL && tile !== TILES.VOID;
    }

    isOpaque(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return true;
        return this.tiles[y][x] === TILES.WALL;
    }

    computeFOV(playerX, playerY, radius = 6) {
        // Reset current visibility
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.visible[y][x] = false;
            }
        }

        // Raycasting in 360 degrees
        const numRays = 180;
        for (let i = 0; i < numRays; i++) {
            const angle = (i * 2 * Math.PI) / numRays;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            let cx = playerX + 0.5;
            let cy = playerY + 0.5;

            for (let r = 0; r <= radius; r += 0.5) {
                const tx = Math.floor(cx);
                const ty = Math.floor(cy);

                if (tx >= 0 && tx < this.width && ty >= 0 && ty < this.height) {
                    this.visible[ty][tx] = true;
                    this.explored[ty][tx] = true;

                    if (this.isOpaque(tx, ty) && (tx !== playerX || ty !== playerY)) {
                        break; // Stop ray on wall
                    }
                }

                cx += cos * 0.5;
                cy += sin * 0.5;
            }
        }
    }

    isVisible(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return this.visible[y][x];
    }

    isExplored(x, y) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        return this.explored[y][x];
    }
}

window.TILES = TILES;
window.GameMap = GameMap;

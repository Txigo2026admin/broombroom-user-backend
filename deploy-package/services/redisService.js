const Redis = require('ioredis');

// Fallback in-memory cache when Redis is offline or not yet started
class MemoryCache {
    constructor(maxEntries = 5000) {
        this.cache = new Map();
        this.maxEntries = maxEntries;
    }

    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            return null;
        }
        return item.value;
    }

    set(key, value, ttlSeconds = 86400) {
        if (this.cache.size >= this.maxEntries) {
            // Evict oldest 10% entries
            const keysToDelete = Array.from(this.cache.keys()).slice(0, Math.floor(this.maxEntries * 0.1));
            for (const k of keysToDelete) this.cache.delete(k);
        }
        this.cache.set(key, {
            value,
            expiry: Date.now() + (ttlSeconds * 1000)
        });
    }

    del(key) {
        this.cache.delete(key);
    }

    delPattern(pattern) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        for (const k of this.cache.keys()) {
            if (regex.test(k)) this.cache.delete(k);
        }
    }
}

const memoryFallback = new MemoryCache();

let client = null;
let isConnected = false;
let hasLoggedWarning = false;

function initRedis() {
    if (client) return client;

    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || '127.0.0.1';
    const redisPort = parseInt(process.env.REDIS_PORT, 10) || 6379;
    const redisPassword = process.env.REDIS_PASSWORD || undefined;

    const options = {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        reconnectOnError: () => true,
        retryStrategy: (times) => {
            // Reconnect with exponential backoff up to 15 seconds
            return Math.min(times * 1500, 15000);
        }
    };

    if (redisPassword) options.password = redisPassword;

    try {
        if (redisUrl) {
            client = new Redis(redisUrl, options);
        } else {
            client = new Redis({
                host: redisHost,
                port: redisPort,
                ...options
            });
        }

        client.on('connect', () => {
            isConnected = true;
            hasLoggedWarning = false;
            console.log('[Redis] Connected to Redis server successfully.');
        });

        client.on('ready', () => {
            isConnected = true;
        });

        client.on('error', (err) => {
            isConnected = false;
            if (!hasLoggedWarning) {
                console.warn('[Redis] Redis server not reachable (' + err.message + '). Active fallback: high-speed in-memory cache.');
                hasLoggedWarning = true;
            }
        });

        client.on('close', () => {
            isConnected = false;
        });
    } catch (e) {
        client = null;
        isConnected = false;
        if (!hasLoggedWarning) {
            console.warn('[Redis] Failed to initialize Redis client. Active fallback: in-memory cache.');
            hasLoggedWarning = true;
        }
    }

    return client;
}

// Auto-initialize
initRedis();

const redisService = {
    /**
     * Retrieve parsed value from Redis or memory cache
     */
    async get(key) {
        if (!key) return null;
        try {
            if (isConnected && client) {
                const data = await client.get(key);
                if (data != null) {
                    try {
                        return JSON.parse(data);
                    } catch (_) {
                        return data;
                    }
                }
            }
        } catch (_) {}

        // Fallback to memory cache
        return memoryFallback.get(key);
    },

    /**
     * Store value in Redis (with TTL) and also memory fallback
     */
    async set(key, value, ttlSeconds = 86400) {
        if (!key || value === undefined || value === null) return;
        const serialized = typeof value === 'string' ? value : JSON.stringify(value);

        // Always store in memory fallback
        memoryFallback.set(key, value, ttlSeconds);

        if (isConnected && client) {
            try {
                if (ttlSeconds > 0) {
                    await client.setex(key, ttlSeconds, serialized);
                } else {
                    await client.set(key, serialized);
                }
            } catch (_) {}
        }
    },

    /**
     * Delete key from Redis and memory fallback
     */
    async del(key) {
        if (!key) return;
        memoryFallback.del(key);
        if (isConnected && client) {
            try {
                await client.del(key);
            } catch (_) {}
        }
    },

    /**
     * Delete keys matching pattern
     */
    async delPattern(pattern) {
        if (!pattern) return;
        memoryFallback.delPattern(pattern);
        if (isConnected && client) {
            try {
                const keys = await client.keys(pattern);
                if (keys && keys.length > 0) {
                    await client.del(keys);
                }
            } catch (_) {}
        }
    },

    /**
     * Check if Redis is actively connected
     */
    isReady() {
        return isConnected;
    },

    /**
     * Return direct client if needed
     */
    getClient() {
        return client;
    }
};

module.exports = redisService;

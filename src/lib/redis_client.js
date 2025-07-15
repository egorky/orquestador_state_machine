const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

/**
 * @description Establishes a connection to the Redis server if not already connected.
 */
async function connect() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
}

connect();

/**
 * @description Saves data to Redis with a specified key and expiration time.
 * @param {string} key - The key to store the data under.
 * @param {object} data - The data to be stored.
 */
async function saveData(key, data) {
    await connect();
    const prefixedKey = `conversation:${key}`;
    const expiration = parseInt(process.env.REDIS_EXPIRATION_SECONDS) || 3600;
    await redisClient.set(prefixedKey, JSON.stringify(data), {
        EX: expiration,
    });
}

/**
 * @description Loads data from Redis for a given key.
 * @param {string} key - The key of the data to retrieve.
 * @returns {Promise<object|null>} The retrieved data, or null if not found.
 */
async function loadData(key) {
    await connect();
    const prefixedKey = `conversation:${key}`;
    const data = await redisClient.get(prefixedKey);
    return data ? JSON.parse(data) : null;
}

module.exports = {
    saveData,
    loadData,
};

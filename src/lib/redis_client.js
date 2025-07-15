const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
    url: process.env.REDIS_URL
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

async function connect() {
    if (!redisClient.isOpen) {
        await redisClient.connect();
    }
}

connect();

async function saveData(key, data, expiration = 3600) {
    await connect();
    const prefixedKey = `conversation:${key}`;
    await redisClient.set(prefixedKey, JSON.stringify(data), {
        EX: expiration,
    });
}

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

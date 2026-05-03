const NodeCache = require("node-cache");

const cache = new NodeCache({
  stdTTL: 300,
  checkperiod: 60,
  useClones: false,
});

const cacheMiddleware = (duration = 300) => {
  return (req, res, next) => {
    const key = `cache_${req.originalUrl}`;
    const cached = cache.get(key);

    if (cached) {
      console.log(`📦 Cache HIT: ${key}`);
      return res.json(cached);
    }

    const originalJson = res.json.bind(res);
    res.json = (data) => {
      cache.set(key, data, duration);
      console.log(`💾 Cache SET: ${key}`);
      return originalJson(data);
    };

    next();
  };
};

const clearCache = (pattern) => {
  const keys = cache.keys();
  keys.forEach((key) => {
    if (key.includes(pattern)) {
      cache.del(key);
    }
  });
};

module.exports = { cache, cacheMiddleware, clearCache };
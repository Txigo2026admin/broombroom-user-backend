/**
 * In-memory sliding-window IP rate limiter for brute-force protection
 */
const ipAttempts = new Map();

// Periodic cleanup every 10 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of ipAttempts.entries()) {
        if (now - data.resetTime > 0) {
            ipAttempts.delete(ip);
        }
    }
}, 10 * 60 * 1000);

const adminLoginRateLimiter = (options = {}) => {
    const windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes window
    const maxAttempts = options.maxAttempts || 15;        // 15 attempts per window per IP

    return (req, res, next) => {
        const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
        const now = Date.now();

        let record = ipAttempts.get(ip);
        if (!record || now > record.resetTime) {
            record = {
                count: 1,
                resetTime: now + windowMs
            };
            ipAttempts.set(ip, record);
            return next();
        }

        record.count += 1;

        if (record.count > maxAttempts) {
            const retryAfterSec = Math.ceil((record.resetTime - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({
                success: false,
                message: `Too many login attempts from this IP address. Please wait ${Math.ceil(retryAfterSec / 60)} minutes before trying again.`,
                retryAfterSeconds: retryAfterSec
            });
        }

        next();
    };
};

module.exports = {
    adminLoginRateLimiter
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const redis_1 = require("../lib/redis");
const uuid_1 = require("uuid");
const dbClient_1 = require("../utils/dbClient");
class AuthService {
    constructor() {
        this.usersByEmail = {};
    }
    async register(name, email, password, ph_number) {
        ph_number = "1234567890";
        console.log(name, email, password, ph_number);
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const user = await dbClient_1.dbClient.createUser({ name, email, password: hashedPassword, ph_number, role: 'USER' });
        await dbClient_1.dbClient.createUserPrefrences(user.id);
        this.usersByEmail[email] = user;
        return user;
    }
    async login(email, password) {
        const user = await dbClient_1.dbClient.getUserByEmail(email);
        if (!user || !(await bcryptjs_1.default.compare(password, user.password))) {
            throw new Error('Invalid email or password');
        }
        const existingSessionToken = await redis_1.redisClient.get(`user:${user.id}:session`);
        if (existingSessionToken) {
            await redis_1.redisClient.del(`session:${existingSessionToken}`);
        }
        const newSessionToken = (0, uuid_1.v4)();
        // await redisClient.set(`session:${newSessionToken}`, JSON.stringify({ userId: user.id }), { EX: 86400 });
        await redis_1.redisClient.set(`session:${newSessionToken}`, JSON.stringify({ userId: user.id }));
        await redis_1.redisClient.expire(`session:${newSessionToken}`, 86400); // 86400 seconds = 1 day
        // await redisClient.set(`user:${user.id}:session`, newSessionToken, { EX: 86400 });
        await redis_1.redisClient.set(`user:${user.id}:session`, newSessionToken);
        await redis_1.redisClient.expire(`user:${user.id}:session`, 86400); // Setting TTL (86400 seconds = 1 day)
        return { token: newSessionToken, name: user.name, email: user.email, verified: user.verified }; // Return session token to the client
    }
    async logout(userId) {
        const sessionToken = await redis_1.redisClient.get(`user:${userId}:session`);
        if (sessionToken) {
            await redis_1.redisClient.del(`session:${sessionToken}`);
            await redis_1.redisClient.del(`user:${userId}:session`);
        }
    }
    async getUserBySessionToken(sessionToken) {
        const session = await redis_1.redisClient.get(`session:${sessionToken}`);
        if (session) {
            const { userId } = JSON.parse(session);
            return dbClient_1.dbClient.getUserById(userId);
        }
        return null;
    }
}
exports.authService = new AuthService();
//# sourceMappingURL=auth.service.js.map
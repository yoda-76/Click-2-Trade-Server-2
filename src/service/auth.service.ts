import bcrypt from 'bcryptjs';
import {redisClient} from '../lib/redis';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/user';
import { dbClient } from '../utils/dbClient';

class AuthService {
  usersByEmail: { [key: string]: User } = {};

  async register(name: string, email: string, password: string, ph_number: string) {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await dbClient.createUser({ name, email, password: hashedPassword, ph_number, role: 'USER' });
    this.usersByEmail[email] = user;
    return user;
  }
  
  async login(email: string, password: string): Promise<{token:string, name: string, email: string, verified: boolean} | null> {
    const user = await dbClient.getUserByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new Error('Invalid email or password');
    }


    const existingSessionToken = await redisClient.get(`user:${user.id}:session`);
    if (existingSessionToken) {
      await redisClient.del(`session:${existingSessionToken}`);
    }

    const newSessionToken = uuidv4();
    // await redisClient.set(`session:${newSessionToken}`, JSON.stringify({ userId: user.id }), { EX: 86400 });
    await redisClient.set(`session:${newSessionToken}`, JSON.stringify({ userId: user.id }));
    await redisClient.expire(`session:${newSessionToken}`, 86400); // 86400 seconds = 1 day

    // await redisClient.set(`user:${user.id}:session`, newSessionToken, { EX: 86400 });
    await redisClient.set(`user:${user.id}:session`, newSessionToken);
    await redisClient.expire(`user:${user.id}:session`, 86400); // Setting TTL (86400 seconds = 1 day)

    return {token:newSessionToken, name: user.name, email: user.email, verified: user.verified}; // Return session token to the client
  }

  async logout(userId: string) {
    const sessionToken = await redisClient.get(`user:${userId}:session`);
    if (sessionToken) {
      await redisClient.del(`session:${sessionToken}`);
      await redisClient.del(`user:${userId}:session`);
    }
  }

  async getUserBySessionToken(sessionToken: string) {
    const session = await redisClient.get(`session:${sessionToken}`);
    if (session) {
      const { userId } = JSON.parse(session);
      return dbClient.getUserById(userId);
    }
    return null;
  }
}

export const authService = new AuthService();

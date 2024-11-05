import { User } from '../models/user';
declare class AuthService {
    usersByEmail: {
        [key: string]: User;
    };
    register(name: string, email: string, password: string, ph_number: string): Promise<{
        id: string;
        name: string;
        email: string;
        password: string;
        total_pnl: number;
        ph_number: string;
        ph_number_verified: boolean;
        photo: string;
        verified: boolean;
        subscriptionExpiry: Date;
        role: import(".prisma/client").$Enums.Role;
    }>;
    login(email: string, password: string): Promise<{
        token: string;
        name: string;
        email: string;
        verified: boolean;
    } | null>;
    logout(userId: string): Promise<void>;
    getUserBySessionToken(sessionToken: string): Promise<{
        id: string;
        name: string;
        email: string;
        password: string;
        total_pnl: number;
        ph_number: string;
        ph_number_verified: boolean;
        photo: string;
        verified: boolean;
        subscriptionExpiry: Date;
        role: import(".prisma/client").$Enums.Role;
    }>;
}
export declare const authService: AuthService;
export {};

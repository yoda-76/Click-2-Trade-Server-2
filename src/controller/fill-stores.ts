import { Request, Response } from "express";
import {  authService } from "../service/auth.service";


export const fillAllStores = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.user.id;
        await authService.logout(userId);
        res.json({ message: 'Logged out successfully' });
        
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
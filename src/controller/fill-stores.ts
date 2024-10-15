import { Request, Response } from "express";
import {  authService } from "../service/auth.service";
import { AccountManager } from "core/accountsManager";


export const fillAllStores = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.user.id;
        const accountManager = AccountManager.getInstance();

        //prefrences
        //master account details
        //child account details
        //structured-options-data
        //positions
        //orderbook
        res.json({ message: 'Logged out successfully' });
        
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

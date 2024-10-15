import { Request, Response } from "express";
import { AccountManager } from "../core/accountsManager";
import { dbClient } from "../utils/dbClient";


//get user details
export const getUserDetails = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.user.id;
        const userDetails = await dbClient.getUserById(userId);

        res.json({message:"ok",data: {
            name: userDetails.name,
            email: userDetails.email,
            verified: userDetails.verified
        }});
        } catch (error) {
        res.status(400).json({ error: error.message });
        }
}
//update password
//update preferences
export const updatePrefrences = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.user.id;
        const resp = await dbClient.updateUserPrefrencesById(userId, req.body);
        res.json({message:"ok"});
        } catch (error) {
        res.status(400).json({ error: error.message });
        }
  }

export const getPrefrences = async (req: Request, res: Response) => {
    try {
        const userId = res.locals.user.id;
        const resp = await dbClient.getUserPrefrencesById(userId);
        res.json({message:"ok",data:resp});
        } catch (error) {
        res.status(400).json({ error: error.message });
        }
  }
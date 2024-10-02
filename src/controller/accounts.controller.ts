import { Request, Response } from "express";
import { AccountManager } from "../core/accountsManager";


export const addAccount = async (req: Request, res: Response) => {
    const {
        key,
        secret,
        broker,
        broker_id,
        type,
        master,
        u_id
      }: {
        key: string;
        secret: string;
        broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO";
        broker_id: string;
        type: string;
        master: string;
        u_id:string
      } = req.body;
  try {
    const user_id = res.locals.user.id;
    console.log(user_id, req.body);
    const accountManager = AccountManager.getInstance();
    const account = await accountManager.addAccount(user_id, key, secret, broker, broker_id, type, master, u_id);
    res.json({message: "Account created successfully", u_id:account.u_id});
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
}


export const getFunds = async (req: Request, res: Response) => {
    const {accountId}= req.body
    try {
      const accountManager = AccountManager.getInstance();
      const funds = await accountManager.getFunds(accountId);
      res.json({message:"ok",funds});
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
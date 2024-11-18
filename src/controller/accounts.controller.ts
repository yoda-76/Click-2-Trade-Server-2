import { Request, Response } from "express";
import { AccountManager } from "../core/accountsManager";
import { dbClient } from "../utils/dbClient";
import { extractId } from "../utils/extractId";


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
    // console.log(user_id, req.body);
    const accountManager = AccountManager.getInstance();
    const account = await accountManager.addAccount(user_id, key, secret, broker, broker_id, type, master, u_id);
    res.json({message: "Account created successfully", u_id:account.u_id});
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
}

export const deleteMasterAccount = async (req: Request, res: Response) => {
    const {master_u_id} = req.body
    try {
      const accountManager = AccountManager.getInstance();
      await accountManager.deleteMasterAccount(`MASTER:${master_u_id}`);
      res.json({message:"ok"});
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
export const deleteChildAccount = async (req: Request, res: Response) => {
    const {child_u_id} = req.body
    try {
      const accountManager = AccountManager.getInstance();
      await accountManager.deleteChildAccount(`CHILD:${child_u_id}`);
      res.json({message:"ok"});
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

export const getFunds = async (req: Request, res: Response) => {
    const {account_id}= req.body
    // console.log(req.body);
    try {
      const accountManager = AccountManager.getInstance();
      const funds = await accountManager.getFunds(account_id);
      res.json({message:"ok",funds});
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }


  export const getAccounts = async (req: Request, res: Response) => {
    try {
      const user_id = res.locals.user.id;
      const masterAccounts = await dbClient.getMasterAccountsByUserId(user_id);
      
      const accounts = [];
  
      for (const masterAccount of masterAccounts) {
        const tempMasterAccount = { ...masterAccount, childAccounts: [] };
        const childAccounts = await dbClient.getChildAccountsByMasterId(masterAccount.id);
        
        for (const childAccount of childAccounts) {
          if (childAccount.active) {
            tempMasterAccount.childAccounts.push(childAccount);
          }
        }
        
        accounts.push(tempMasterAccount);
      }
  
      console.log(accounts);
      res.json({ message: "ok", accounts });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  };
    

export const getChildAccountByMasterUid = async (req: Request, res: Response) => {
  try {
      const id = req.body.master_u_id
      if(!id){
        return res.status(400).json({ error: "Invalid request." });
      }
      const accountManager = AccountManager.getInstance();
      const masterAccountId = accountManager.getAuthenticatedAccountId(id);
      if(!masterAccountId){
        return res.status(400).json({ error: "Account not authenticated." });
      }
      const childAccounts = await dbClient.getChildAccountsByMasterId(masterAccountId);
      res.json({message:"ok",childAccounts});
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
}


export const updateChildMultiplier = async (req: Request, res: Response) => {
  try {
    const {child_u_id, multiplier}:{child_u_id: string, multiplier: number} = req.body
    const accountManager = AccountManager.getInstance();
    const childAccountId = accountManager.getAuthenticatedAccountId(`CHILD:${child_u_id}`);
    console.log(childAccountId);
    await dbClient.updateChildAccountById(childAccountId, {multiplier});
    res.json({message:"ok"});
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const toggleChildAccount = async (req: Request, res: Response) => {
  try {
    const {child_u_id, status}:{child_u_id: string, status: boolean} = req.body
    const accountManager = AccountManager.getInstance();
    const childAccountId = accountManager.getAuthenticatedAccountId(`CHILD:${child_u_id}`);
    await dbClient.updateChildAccountById(childAccountId, {active: status});
    res.json({message:"ok"});
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
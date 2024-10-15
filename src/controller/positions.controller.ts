import { Request, Response } from "express";
import { OrderManager } from "../core/orders";


export const getPositions = async (req: Request, res: Response) => {
  const {account_id}:{account_id: string} = req.body;
  try {
    const positions = await OrderManager.getInstance().getPositions(account_id);
    console.log("positions",positions);
    res.json(positions)
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const getTrackedPositions = async (req: Request, res: Response) => {
  const {accountId}:{accountId: string} = req.body;
  try {

  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
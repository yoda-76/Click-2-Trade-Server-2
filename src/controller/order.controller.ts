import { Request, Response } from "express";
import { OrderManager } from "../core/orders";
import { OrderDetails } from "Interface";

interface placeOrderRequest extends OrderDetails{
  accountId: string
}
export const placeOrder = async (req: Request, res: Response) => {
  const { accountId, baseInstrument, instrumentType,expiry, strike, optionType, exchange, qty, price, triggerPrice, orderType, side, productType }: placeOrderRequest = req.body;
  try {
    console.log(req.body); 
    const orderManager = await OrderManager.getInstance();
    const order = await orderManager.placeOrder(accountId, {baseInstrument, instrumentType, expiry, strike, optionType, exchange, qty, price , triggerPrice , orderType, side, productType});
    res.json({message: "Order placed successfully", order});
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const cancelOrder = async (req: Request, res: Response) => {
  const { accountId, orderId } = req.body;
  try {
    const orderManager = await OrderManager.getInstance();
    await orderManager.cancelOrder(accountId, orderId);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const cancelAllOrders = async (req: Request, res: Response) => {
  const { accountId } = req.body;
  try {
    const orderManager = await OrderManager.getInstance();
    await orderManager.cancelAllOrders(accountId);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const getOrders = async (req: Request, res: Response) => {
  const { accountId } = req.body;
  try {
    const orderManager = await OrderManager.getInstance();
    const orders = await orderManager.getOrderBook(accountId);
    // console.log("orders: ", orders);
    res.json(orders);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const squareoffSinglePositions = async (req: Request, res: Response) => {
  const { account_id, position } = req.body;
  try {
    const orderManager = await OrderManager.getInstance();
    await orderManager.exitSinglePosition(account_id, position);
    res.json({ message: "Position exited successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const squareoffAllPositions = async (req: Request, res: Response) => {
  const { account_id } = req.body;
  try {
    const orderManager = await OrderManager.getInstance();
    await orderManager.exitAllPositions(account_id);
    res.json({ message: "All positions exited successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}
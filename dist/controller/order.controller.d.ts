import { Request, Response } from "express";
export declare const placeOrder: (req: Request, res: Response) => Promise<void>;
export declare const cancelOrder: (req: Request, res: Response) => Promise<void>;
export declare const cancelAllOrders: (req: Request, res: Response) => Promise<void>;
export declare const getOrders: (req: Request, res: Response) => Promise<void>;
export declare const squareoffSinglePositions: (req: Request, res: Response) => Promise<void>;
export declare const squareoffAllPositions: (req: Request, res: Response) => Promise<void>;

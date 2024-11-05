/// <reference types="cookie-parser" />
import { Request, Response } from "express";
export declare const upstoxAuth: (req: Request, res: Response) => Promise<void>;
export declare const dhanAuth: (req: Request, res: Response) => Promise<void>;
export declare function zerodhaAuth(req: Request, res: Response): Promise<void>;
export declare function angelAuth(req: Request, res: Response): Promise<void>;

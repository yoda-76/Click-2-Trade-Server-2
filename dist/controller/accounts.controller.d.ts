import { Request, Response } from "express";
export declare const addAccount: (req: Request, res: Response) => Promise<void>;
export declare const deleteMasterAccount: (req: Request, res: Response) => Promise<void>;
export declare const deleteChildAccount: (req: Request, res: Response) => Promise<void>;
export declare const getFunds: (req: Request, res: Response) => Promise<void>;
export declare const getAccounts: (req: Request, res: Response) => Promise<void>;
export declare const getChildAccountByMasterUid: (req: Request, res: Response) => Promise<void>;
export declare const updateChildMultiplier: (req: Request, res: Response) => Promise<void>;
export declare const toggleChildAccount: (req: Request, res: Response) => Promise<void>;

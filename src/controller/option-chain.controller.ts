import axios from "axios";
import { AccountManager } from "../core/accountsManager";
import OptionChainHandler from "../core/OptionChainService";




export const optionChainController = async (req: any, res: any) => {
    // const {accountId, expiry, base} = req.body;
    const optionChainInstance = OptionChainHandler.getInstance();
    const optionChain = await optionChainInstance.getOptionChain();
      res.json(optionChain);
};
export const optionChainAuthController = async (req: any, res: any) => {
    const authcode = req.query.code as string;
    console.log(authcode);
    try {
        const optionChainInstance = OptionChainHandler.getInstance();
        const msg = await optionChainInstance.storeAccessToken(authcode);
        res.json({message:msg});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

export const getOptionChainDashboard = async (req: any, res: any) => {
    const optionChainInstance = OptionChainHandler.getInstance();
    const optionChainDashBoard = await optionChainInstance.getDashboard();
    res.json(optionChainDashBoard);
}

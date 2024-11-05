import { Request, Response } from "express";
import axios from 'axios';
import crypto from 'crypto';
import { UpstoxBroker } from "../brokers/upstox.service";
import { DhanBroker } from "../brokers/dhan/dhan.service";
import { AngelOne } from "../brokers/angel/angel.service";
var {  KiteConnect } = require("kiteconnect");


export const upstoxAuth = async (req: Request, res: Response) => {
    const authcode = req.query.code as string;
    const id = req.query.state as string;
    console.log(authcode, id);
    try {
        const upstoxBroker = UpstoxBroker.getInstance();
        const msg = await upstoxBroker.handleWebhook(id, authcode);
        res.json({message:msg});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

//dhan
export const dhanAuth = async (req: Request, res: Response) => {
    const {id, access_token, dhanClientId} = req.body;
    try {
        if(!id || !access_token || !dhanClientId){
            res.status(400).json({error: "Invalid request."});
        }
        const dhanBroker = DhanBroker.getInstance();
        const msg = await dhanBroker.handleWebhook(id, access_token, dhanClientId);
        res.json({message:msg});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}


export async function zerodhaAuth(req: Request, res: Response) {
    try {
        const { request_token } = req.query;

        // Define your API key and secret
        const api_secret = process.env.KITE_API_SECRET;
        const api_key = process.env.KITE_API_KEY;

        // Generate checksum using SHA-256 hash of (api_key + request_token + api_secret)
        const kc = new KiteConnect({ api_key });

        const sessionResp = await kc.generateSession(request_token, api_secret);
        console.log("Session response:", sessionResp);
        const access_token = sessionResp.access_token;
        console.log('Access Token:', access_token);

        const upstoxBroker = UpstoxBroker.getInstance();

        const instrumentTokenList = upstoxBroker.getTokensToBeSubscribed(); 
        await axios.post(process.env.KITE_AUTH_SERVER_URL, {key:api_key, access_token, instrumentTokenList});
        // Send a success response
        res.status(200).json({ success: true, access_token });
    } catch (error) {
        console.error('Error exchanging request token:', error);
        res.status(500).json({ success: false, message: 'Authentication failed', error: error.message });
    }
}

export async function angelAuth(req: Request, res: Response) {
    try {
        const {id, clientCode, password, totp}:{
            id: string,
            clientCode: string,
            password: string,
            totp: string}= req.body;
        const angelBroker = AngelOne.getInstance();
        const msg = await angelBroker.handleWebhook(id, clientCode, password, totp);
        res.json({message:msg});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
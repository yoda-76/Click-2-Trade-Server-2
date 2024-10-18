import { Request, Response } from "express";
import axios from 'axios';
import crypto from 'crypto';
import { UpstoxBroker } from "../brokers/upstox.service";
import { DhanBroker } from "../brokers/dhan/dhan.service";

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
        const api_key = 'wmdvpcvumovceox1';
        const api_secret = 'mjws2zn9x2bf30xvq7cuz7pqd0qxvswv';

        // Generate checksum using SHA-256 hash of (api_key + request_token + api_secret)
        const checksum = crypto
            .createHash('sha256')
            .update(api_key + request_token + api_secret)
            .digest('hex');

        // Post the request token and checksum to get the access token
        const response = await axios.post('https://api.kite.trade/session/token', {
            api_key: api_key,
            request_token: request_token,
            checksum: checksum,
        }, {
            headers: {
                'X-Kite-Version': '3',
            },
        });

        // Extract the access token and log it
        const { access_token, user_id } = response.data.data;
        console.log('Access Token:', access_token);
        console.log('User ID:', user_id);

        // Send a success response
        res.status(200).json({ success: true, access_token, user_id });
    } catch (error) {
        console.error('Error exchanging request token:', error);
        res.status(500).json({ success: false, message: 'Authentication failed', error: error.message });
    }
}
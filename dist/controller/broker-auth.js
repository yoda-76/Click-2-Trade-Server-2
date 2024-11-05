"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.angelAuth = exports.zerodhaAuth = exports.dhanAuth = exports.upstoxAuth = void 0;
const axios_1 = __importDefault(require("axios"));
const upstox_service_1 = require("../brokers/upstox.service");
const dhan_service_1 = require("../brokers/dhan/dhan.service");
const angel_service_1 = require("../brokers/angel/angel.service");
var { KiteConnect } = require("kiteconnect");
const upstoxAuth = async (req, res) => {
    const authcode = req.query.code;
    const id = req.query.state;
    console.log(authcode, id);
    try {
        const upstoxBroker = upstox_service_1.UpstoxBroker.getInstance();
        const msg = await upstoxBroker.handleWebhook(id, authcode);
        res.json({ message: msg });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.upstoxAuth = upstoxAuth;
//dhan
const dhanAuth = async (req, res) => {
    const { id, access_token, dhanClientId } = req.body;
    try {
        if (!id || !access_token || !dhanClientId) {
            res.status(400).json({ error: "Invalid request." });
        }
        const dhanBroker = dhan_service_1.DhanBroker.getInstance();
        const msg = await dhanBroker.handleWebhook(id, access_token, dhanClientId);
        res.json({ message: msg });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.dhanAuth = dhanAuth;
async function zerodhaAuth(req, res) {
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
        const upstoxBroker = upstox_service_1.UpstoxBroker.getInstance();
        const instrumentTokenList = upstoxBroker.getTokensToBeSubscribed();
        await axios_1.default.post(process.env.KITE_AUTH_SERVER_URL, { key: api_key, access_token, instrumentTokenList });
        // Send a success response
        res.status(200).json({ success: true, access_token });
    }
    catch (error) {
        console.error('Error exchanging request token:', error);
        res.status(500).json({ success: false, message: 'Authentication failed', error: error.message });
    }
}
exports.zerodhaAuth = zerodhaAuth;
async function angelAuth(req, res) {
    try {
        const { id, clientCode, password, totp } = req.body;
        const angelBroker = angel_service_1.AngelOne.getInstance();
        const msg = await angelBroker.handleWebhook(id, clientCode, password, totp);
        res.json({ message: msg });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
}
exports.angelAuth = angelAuth;
//# sourceMappingURL=broker-auth.js.map
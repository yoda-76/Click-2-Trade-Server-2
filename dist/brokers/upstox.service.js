"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpstoxBroker = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zlib_1 = __importDefault(require("zlib"));
const csvtojson_1 = __importDefault(require("csvtojson"));
const extractId_1 = require("../utils/extractId");
const dbClient_1 = require("../utils/dbClient");
const accountsManager_1 = require("../core/accountsManager");
const order_slicer_1 = require("../utils/order-slicer");
const equity_symbols_1 = require("../constant/equity-symbols");
const redis_1 = require("../lib/redis");
const kite_instruments_1 = require("../utils/kite-instruments");
class UpstoxBroker {
    // Singleton pattern
    constructor() {
        this.instrumentData = {}; // In-memory store for instrument data
        this.tokenToBeSubscribed = []; // Token to be subscribed to for order updates
        this.instrumentDataSearchMap = new Map(); // In-memory store for instrument data
        this.loadInstrumentData(); // Load instruments when the broker is initialized
    }
    static getInstance() {
        if (!UpstoxBroker.instance) {
            UpstoxBroker.instance = new UpstoxBroker();
        }
        return UpstoxBroker.instance;
    }
    getInstrumentDataAsObject() {
        // console.log(this.instrumentData);
        return this.instrumentData;
    }
    getInstrumentDataSearchMapAsObject() {
        console.log(this.instrumentDataSearchMap);
        return this.instrumentDataSearchMap;
    }
    // Handle access token received via webhook
    async handleWebhook(id, authcode) {
        try {
            const currentdate = new Date();
            const acc = (0, extractId_1.extractId)(id); // Function to extract ID and determine type (MASTER/CHILD)
            let user_id = "";
            let master_id = "";
            let userData;
            if (acc.type === "CHILD") {
                userData = await dbClient_1.dbClient.getChildAccountByUid(acc.id);
                master_id = userData.master_id;
            }
            else if (acc.type === "MASTER") {
                userData = await dbClient_1.dbClient.getMasterAccountByUid(acc.id);
                user_id = userData.user_id;
            }
            else {
                throw new Error("Error authorizing with Upstox : .Controllers/Authorization: handleWebhook");
            }
            // Fetch access token using the authorization code
            console.log({
                code: authcode,
                client_id: userData.key,
                client_secret: userData.secret,
                redirect_uri: process.env.UPSTOX_REDIRECT_URL,
                grant_type: "authorization_code",
            });
            const response = await axios_1.default.post("https://api.upstox.com/v2/login/authorization/token", new URLSearchParams({
                code: authcode,
                client_id: userData.key,
                client_secret: userData.secret,
                redirect_uri: process.env.UPSTOX_REDIRECT_URL,
                grant_type: "authorization_code",
            }), {
                headers: {
                    Accept: "application/json",
                    "Api-Version": "2.0",
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            });
            // Process the response
            const access_token = response.data.access_token;
            let account;
            // Store the access token in-memory and update DB
            const accountManager = accountsManager_1.AccountManager.getInstance();
            if (acc.type === "MASTER") {
                await dbClient_1.dbClient.updateMasterAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
                accountManager.addAuthenticatedAccount(user_id, master_id, "MASTER", userData.key, userData.broker_id, id, userData.id, access_token, "UPSTOCKS");
            }
            else {
                await dbClient_1.dbClient.updateChildAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
                accountManager.addAuthenticatedAccount(user_id, master_id, "CHILD", userData.key, userData.broker_id, id, userData.id, access_token, "UPSTOCKS");
            }
            // Get the singleton instance of AccountManager and add the account
            console.log("Access token for account stored successfully.");
            return `Access token for account ${id} stored successfully.`;
        }
        catch (error) {
            console.error("Error in handleWebhook:", error);
            throw new Error("Error authorizing with Upstox : .Controllers/Authorization: handleWebhook");
        }
    }
    isAuthenticated(accountId) {
        const account = UpstoxBroker.authenticatedAccounts.get(accountId);
        if (!account)
            return false;
        const now = new Date();
        return account.expiresAt > now;
    }
    // Place order using the access token
    async placeOrder(accountId, orderDetails) {
        //check funds first
        try {
            const accountManager = accountsManager_1.AccountManager.getInstance();
            const account = accountManager.getAuthenticatedAccountsAsObject(accountId);
            // const account = UpstoxBroker.authenticatedAccounts.get(accountId);
            console.log(account);
            if (!account) {
                throw new Error('Account not authenticated');
            }
            const { baseInstrument, instrumentType, expiry, strike, optionType, exchange, qty, price, triggerPrice, orderType, side, productType } = orderDetails;
            console.log(orderDetails);
            let key = "";
            if (exchange === "BSE") {
                throw new Error('BSE not supported');
            }
            if (instrumentType === "OPT") {
                console.log(this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.0`][optionType]);
                key = this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.0`][optionType].instrument_key;
            }
            else if (instrumentType === "EQ") {
                key = this.instrumentData.NSE.EQUITY[baseInstrument].instrument_key;
            }
            else if (instrumentType === "FUT") {
                throw new Error('Futures not supported');
            }
            else {
                throw new Error('Instrument type not supported');
            }
            const slicedQty = (0, order_slicer_1.sliceOrderQuantity)(qty, baseInstrument);
            console.log(slicedQty);
            for (let i = 0; i < slicedQty.length; i++) {
                let config = {
                    url: "https://api.upstox.com/v2/order/place",
                    method: "post", // Add the 'method' property and set it to 'post'
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        Authorization: `Bearer ${account.accessToken}`,
                    },
                    data: {
                        quantity: slicedQty[i],
                        product: productType === "I" || productType === "D" ? productType : productType === "INTRADAY" ? "I" : "D",
                        validity: "DAY",
                        price: orderType === "LIMIT" ? price : 0,
                        tag: "string",
                        instrument_token: key,
                        order_type: orderType,
                        transaction_type: side,
                        disclosed_quantity: 0,
                        trigger_price: triggerPrice,
                        is_amo: false,
                    },
                };
                //check if the quantity exceeds the freeze quqntity for that perticular index? if it does, then slice the order
                const response = await (0, axios_1.default)(config);
                console.log(response);
                return response.data.data.order_id;
            }
            return true;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    async cancelOrder(accountId, orderId) {
        try {
            const accountManager = accountsManager_1.AccountManager.getInstance();
            const account = accountManager.getAuthenticatedAccountsAsObject(accountId);
            let config = {
                method: 'delete',
                maxBodyLength: Infinity,
                url: `https://api-hft.upstox.com/v2/order/cancel?order_id=${orderId}`,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${account.accessToken}`,
                }
            };
            const response = await (0, axios_1.default)(config);
            return response.data.data;
        }
        catch (error) {
            throw error;
        }
    }
    async getOrderDetailsByOrderId(accountId, orderId) {
        try {
            const accountManager = accountsManager_1.AccountManager.getInstance();
            const access_token = accountManager.getAccessToken(accountId);
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: `https://api.upstox.com/v2/order/details?order_id=${orderId}`,
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${access_token}`,
                }
            };
            const response = await (0, axios_1.default)(config);
            const convertedOrderbook = {
                symbolName: response.data.data.trading_symbol,
                type: response.data.data.order_type,
                side: response.data.data.transaction_type,
                qty: response.data.data.quantity,
                remQty: response.data.data.pending_quantity,
                orderPrice: response.data.data.price,
                tradedPrice: response.data.data.average_price,
                triggerPrice: response.data.data.trigger_price,
                status: response.data.data.status,
                timeStamp: response.data.data.order_timestamp,
                orderId: response.data.data.order_id,
                message: response.data.data.status_message || ""
            };
            return convertedOrderbook;
        }
        catch (error) {
            throw error;
        }
    }
    async getPositions(access_token) {
        try {
            console.log("at", access_token);
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: 'https://api.upstox.com/v2/portfolio/short-term-positions',
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${access_token}`,
                }
            };
            const response = await (0, axios_1.default)(config);
            console.log("position from broker", response.data.data);
            let convertedPositions = response.data.data.map((position) => {
                const symbolName = position.trading_symbol;
                const symbolDetails = this.instrumentDataSearchMap[symbolName];
                return {
                    netQty: position.quantity, // Net Qty
                    symbolName: position.trading_symbol, // Symbol name
                    baseInstrument: symbolDetails.name, // Base Instrument
                    instrumentType: symbolDetails.instrument_type, // Instrument Type
                    optionType: symbolDetails.option_type, //option type
                    expiry: symbolDetails.expiry, // Expiry
                    strike: symbolDetails.strike, // Option Type
                    ltpToken: symbolDetails.ltpToken ? symbolDetails.ltpToken : null, // LTP Token
                    exchange: symbolDetails.exchange, // Exchange
                    action: null, // Action (Buy/Sell based on qty)
                    pnl: position.pnl, // PnL
                    ltp: position.last_price, // LTP
                    avgPrice: position.average_price, // Avg Price
                    sl: null, // SL (manual entry)
                    setSl: null, // Set SL (manual entry)
                    target: null, // Target (manual entry)
                    targetPrice: null, // Target Price (manual entry)
                    stopLoss: null,
                    multiplier: position.multiplier, // Stop Loss (manual entry)
                    buyPrice: position.buy_price, // Buy Price
                    sellPrice: position.sell_price, // Sell Price
                    buyQty: position.day_buy_quantity, // Buy Qty
                    sellQty: position.day_sell_quantity,
                    buyValue: position.buy_value,
                    sellValue: position.sell_value, // Sell Qty
                    realisedPnL: position.realised, // Realised P&L
                    unrealisedPnL: position.unrealised, // Unrealised P&L
                    product: position.product // Product
                };
            });
            console.log("cp", convertedPositions);
            return convertedPositions;
        }
        catch (error) {
        }
    }
    async getPositionByOrderDetails(accountId, orderDetails) {
        try {
            const accountManager = accountsManager_1.AccountManager.getInstance();
            const access_token = accountManager.getAccessToken(accountId);
            let config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: 'https://api.upstox.com/v2/portfolio/short-term-positions',
                headers: {
                    Accept: "application/json",
                    Authorization: `Bearer ${access_token}`,
                }
            };
            const response = await (0, axios_1.default)(config);
            console.log("positions from broker", response.data.data);
            let position;
            let instrumentDetails;
            if (orderDetails.exchange === "BSE") {
                throw new Error('BSE not supported');
            }
            if (orderDetails.instrumentType === "OPT") {
                instrumentDetails = this.instrumentData.NSE[orderDetails.baseInstrument][`${orderDetails.expiry} : ${orderDetails.strike}.0`][orderDetails.optionType];
            }
            else if (orderDetails.instrumentType === "EQ") {
                instrumentDetails = this.instrumentData.NSE.EQUITY[orderDetails.baseInstrument];
            }
            else if (orderDetails.instrumentType === "FUT") {
                throw new Error('Futures not supported');
            }
            else {
                throw new Error('Instrument type not supported');
            }
            response.data.data.map((p) => {
                if (p.trading_symbol === instrumentDetails.tradingsymbol) {
                    position = p;
                }
            });
            console.log({ orderDetails, position, instrumentDetails });
            const convertedPosition = {
                netQty: position.quantity, // Net Qty
                symbolName: position.trading_symbol, // Symbol name
                baseInstrument: instrumentDetails.base, // Base Instrument
                instrumentType: instrumentDetails.instrument_type, // Instrument Type
                expiry: instrumentDetails.expiry, // Expiry
                strike: instrumentDetails.strike, // Strike
                optionType: orderDetails.optionType, // Option Type
                ltpToken: instrumentDetails.ltpToken ? instrumentDetails.ltpToken : null, // LTP Token
                exchange: position.exchange === "NFO" || position.exchange === "NSE" ? "NSE" : null, // Exchange
                action: null, // Action (Buy/Sell based on qty)
                pnl: position.pnl, // PnL
                ltp: position.last_price, // LTP
                avgPrice: position.average_price, // Avg Price
                sl: null, // SL (manual entry)
                setSl: null, // Set SL (manual entry)
                target: null, // Target (manual entry)
                setTarget: null, // Set Target (manual entry)
                buyPrice: position.buy_price, // Buy Price
                sellPrice: position.sell_price, // Sell Price
                buyQty: position.day_buy_quantity, // Buy Qty
                sellQty: position.day_sell_quantity, // Sell Qty
                realisedPnL: position.realised, // Realised P&L
                unrealisedPnL: position.unrealised, // Unrealised P&L
                product: position.product // Product
            };
            console.log("converted position", convertedPosition);
            return convertedPosition;
        }
        catch (error) {
            throw error;
        }
    }
    // Load instrument data into memory
    async loadInstrumentData() {
        try {
            const folderPath = path_1.default.join(__dirname, 'token_data');
            const compressedFilePath = path_1.default.join(folderPath, 'instrument_data.csv.gz');
            const decompressedFilePath = path_1.default.join(folderPath, 'instrument_data.csv');
            // Ensure the directory exists
            if (!fs_1.default.existsSync(folderPath)) {
                fs_1.default.mkdirSync(folderPath);
            }
            // Download and decompress instrument data
            await (0, axios_1.default)({
                method: 'get',
                url: 'https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz',
                responseType: 'stream',
            }).then((response) => {
                const writer = fs_1.default.createWriteStream(compressedFilePath);
                response.data.pipe(writer);
                return new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            });
            // Decompress file
            await new Promise((resolve, reject) => {
                const input = fs_1.default.createReadStream(compressedFilePath);
                const output = fs_1.default.createWriteStream(decompressedFilePath);
                input.pipe(zlib_1.default.createGunzip()).pipe(output);
                output.on('finish', resolve);
                output.on('error', reject);
            });
            // Convert CSV to JSON and structure data
            const jsonArray = await (0, csvtojson_1.default)().fromFile(decompressedFilePath);
            //fetch kite instruments
            const kiteAccessToken = await redis_1.redisClient.get('KITE_CONNECT_access_token');
            const kiteInstruments = await (0, kite_instruments_1.fetchInstruments)(process.env.KITE_API_KEY, kiteAccessToken);
            this.instrumentData = this.structureInstrumentData(jsonArray, kiteInstruments); // Structure the data
            console.log('Instrument data loaded into memory and structured');
        }
        catch (error) {
            console.error('Error loading instrument data:', error.message || error);
        }
    }
    // Structure instrument data for quick access
    structureInstrumentData(jsonArray, kiteInstruments) {
        const structuredData = {
            "NSE": {
                "INDEX": {
                    "NIFTY": {},
                    "BANKNIFTY": {},
                    "FINNIFTY": {},
                },
                "EQUITY": {},
                "BANKNIFTY": {},
                "FINNIFTY": {},
                "NIFTY": {},
            }
        };
        const isNifty50Option = /^NIFTY\d{2}([A-Z]{3}|\d{3})\d{5}(CE|PE)$/;
        jsonArray.forEach(instrument => {
            const { name, instrument_type, tradingsymbol, option_type, expiry, strike, exchange } = instrument;
            // Index handling
            if (instrument_type === "INDEX") {
                if (name === "Nifty 50")
                    structuredData.NSE.INDEX.NIFTY = instrument;
                if (name === "Nifty Bank")
                    structuredData.NSE.INDEX.BANKNIFTY = instrument;
                if (name === "Nifty Fin Service")
                    structuredData.NSE.INDEX.FINNIFTY = instrument;
            }
            // Options handling
            if (instrument_type === "OPTIDX" && exchange === "NSE_FO") {
                if (option_type === "CE") {
                    const baseSymbol = tradingsymbol.slice(0, -2);
                    // Match CE with PE
                    jsonArray.forEach(otherInstrument => {
                        if (otherInstrument.option_type === "PE") {
                            const otherBaseSymbol = otherInstrument.tradingsymbol.slice(0, -2);
                            if (baseSymbol === otherBaseSymbol) {
                                if (tradingsymbol.includes("BANKNIFTY")) {
                                    structuredData.NSE.BANKNIFTY[`${expiry} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                                }
                                else if (tradingsymbol.includes("FINNIFTY")) {
                                    structuredData.NSE.FINNIFTY[`${expiry} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                                }
                                else if (isNifty50Option.test(tradingsymbol)) {
                                    structuredData.NSE.NIFTY[`${expiry} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                                }
                            }
                        }
                    });
                }
            }
            else if (instrument_type === "EQUITY" && exchange === "NSE_EQ" && equity_symbols_1.equitySymbols.includes(tradingsymbol)) {
                structuredData.NSE.EQUITY[tradingsymbol] = instrument;
            }
        });
        kiteInstruments.map((instrument) => {
            if (instrument.segment === "NFO-OPT" && (instrument.name === "NIFTY" || instrument.name === "BANKNIFTY" || instrument.name === "FINNIFTY") && (instrument.instrument_type === "PE" || instrument.instrument_type === "CE") && structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.0`] && structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.0`][instrument.instrument_type]) {
                structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.0`][instrument.instrument_type].ltpToken = instrument.instrument_token;
                //add ltp token to subscribed instruments list
                this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                //create a map with symbol from broker as key and info from broker + info from kite as value
                const upstoxData = structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.0`][instrument.instrument_type];
                this.instrumentDataSearchMap[upstoxData.tradingsymbol] = Object.assign(Object.assign({}, upstoxData), instrument);
            }
            else if (instrument.segment === "INDICES" && instrument.exchange === "NSE" && (instrument.name === "NIFTY 50" || instrument.name === "NIFTY BANK" || instrument.name === "NIFTY FIN SERVICE")) {
                if (instrument.name === "NIFTY 50") {
                    structuredData.NSE.INDEX.NIFTY.ltpToken = instrument.instrument_token;
                    this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                }
                if (instrument.name === "NIFTY BANK") {
                    structuredData.NSE.INDEX.BANKNIFTY.ltpToken = instrument.instrument_token;
                    this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                }
                if (instrument.name === "NIFTY FIN SERVICE") {
                    structuredData.NSE.INDEX.FINNIFTY.ltpToken = instrument.instrument_token;
                    this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                }
            }
            else if (instrument.segment === "NSE" && instrument.instrument_type === "EQ" && structuredData.NSE.EQUITY[instrument.tradingsymbol]) {
                structuredData.NSE.EQUITY[instrument.tradingsymbol].ltpToken = instrument.instrument_token;
                this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
            }
        });
        return structuredData;
    }
    // Get instrument from memory
    getInstrument(base, expiry, strike, side) {
        var _a, _b, _c;
        return ((_c = (_b = (_a = this.instrumentData) === null || _a === void 0 ? void 0 : _a[base]) === null || _b === void 0 ? void 0 : _b[`${expiry} : ${strike}`]) === null || _c === void 0 ? void 0 : _c[side]) || null;
    }
    getTokensToBeSubscribed() {
        return this.tokenToBeSubscribed;
    }
    //Get funds of an upstox account
    async getFunds(access_token) {
        const url = "https://api.upstox.com/v2/user/get-funds-and-margin";
        const headers = {
            Accept: "application/json",
            Authorization: `Bearer ${access_token}`,
        };
        const resp = await axios_1.default.get(url, { headers });
        console.log(resp);
        return resp.data.data;
    }
    async getTrades(access_token) {
        let config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'https://api.upstox.com/v2/order/trades/get-trades-for-day',
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${access_token}`,
            }
        };
        const response = await (0, axios_1.default)(config);
        return response.data.data;
    }
}
exports.UpstoxBroker = UpstoxBroker;
UpstoxBroker.authenticatedAccounts = new Map();
UpstoxBroker.instance = null;
//# sourceMappingURL=upstox.service.js.map
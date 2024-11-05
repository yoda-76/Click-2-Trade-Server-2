"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AngelOne = void 0;
const axios_1 = __importDefault(require("axios"));
const accountsManager_1 = require("../../core/accountsManager");
const dbClient_1 = require("../../utils/dbClient");
const extractId_1 = require("../../utils/extractId");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const order_slicer_1 = require("../../utils/order-slicer");
const equity_symbols_1 = require("../../constant/equity-symbols");
const redis_1 = require("../../lib/redis");
const kite_instruments_1 = require("../../utils/kite-instruments");
function convertDate(originalDateStr) {
    // Define a mapping of month abbreviations to their corresponding numbers
    const monthMap = {
        JAN: '01',
        FEB: '02',
        MAR: '03',
        APR: '04',
        MAY: '05',
        JUN: '06',
        JUL: '07',
        AUG: '08',
        SEP: '09',
        OCT: '10',
        NOV: '11',
        DEC: '12'
    };
    // Extract the day, month, and year from the string
    const day = originalDateStr.substring(0, 2);
    const monthAbbr = originalDateStr.substring(2, 5);
    const year = originalDateStr.substring(5, 9);
    // Get the month number from the map
    const month = monthMap[monthAbbr.toUpperCase()];
    // Return the formatted date
    return `${year}-${month}-${day}`;
}
class AngelOne {
    // Singleton pattern
    constructor() {
        this.instrumentData = {}; // In-memory store for instrument data
        this.instrumentDataSearchMap = new Map(); // In-memory store for instrument data
        this.tokenToBeSubscribed = []; // Token to be subscribed to for order updates
        this.loadInstrumentData(); // Load instruments when the broker is initialized
    }
    static getInstance() {
        if (!AngelOne.instance) {
            AngelOne.instance = new AngelOne();
        }
        return AngelOne.instance;
    }
    async handleWebhook(id, clientCode, password, totp) {
        var _a, _b, _c, _d;
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
                throw new Error("accountId might be wrong");
            }
            const privateKey = userData.key;
            //generate token 
            const data = JSON.stringify({
                clientcode: clientCode,
                password: password,
                totp: totp
            });
            const config = {
                method: 'post',
                url: 'https://apiconnect.angelone.in//rest/auth/angelbroking/user/v1/loginByPassword',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-UserType': 'USER',
                    'X-SourceID': 'WEB',
                    'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
                    'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
                    'X-MACAddress': 'MAC_ADDRESS',
                    'X-PrivateKey': privateKey,
                },
                data: data
            };
            const response = await (0, axios_1.default)(config);
            console.log(response.data);
            const access_token = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.jwtToken;
            const feedToken = (_d = (_c = response.data) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.feedToken;
            // Store the access token in-memory and update DB
            if (acc.type === "MASTER") {
                await dbClient_1.dbClient.updateMasterAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
            }
            else {
                await dbClient_1.dbClient.updateChildAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
            }
            const accountManager = accountsManager_1.AccountManager.getInstance();
            accountManager.addAuthenticatedAccount(user_id, master_id, "MASTER", userData.key, userData.broker_id, id, userData.id, access_token, "ANGEL");
            console.log("Access token for an Angel account stored successfully.", access_token, (typeof access_token));
            return `Access token for account ${id} stored successfully.`;
        }
        catch (error) {
            console.error("Error in handleWebhook:", error);
            throw new Error(`Error authorizing with Dhan : ${error.message}`);
        }
    }
    getInstrumentDataAsObject() {
        return this.instrumentData;
    }
    getInstrumentDataSearchMapAsObject() {
        console.log(this.instrumentDataSearchMap);
        return this.instrumentDataSearchMap;
    }
    async loadInstrumentData() {
        // Load instruments from CSV file
        const rawInstrumentsDataDownloadLink = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";
        const filePath = path_1.default.join(__dirname, './instruments.JSON');
        // Function to download the CSV file
        const downloadCSV = async () => {
            try {
                const response = await axios_1.default.get(rawInstrumentsDataDownloadLink, {
                    responseType: 'stream', // Set response type to stream for downloading
                });
                console.log("json data downloaded");
                const writer = fs_1.default.createWriteStream(filePath);
                // Pipe the response data to the file
                response.data.pipe(writer);
                // Return a promise that resolves when the file is finished writing
                return new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            }
            catch (error) {
                console.error('Error downloading the CSV file:', error);
            }
        };
        // Call the function to download the CSV
        await downloadCSV().catch((err) => {
            console.error('Failed to download CSV:', err);
        });
        console.log('json file downloaded and saved as instruments.json');
        const data = fs_1.default.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(data);
        // fetch kite instruments
        const kiteAccessToken = await redis_1.redisClient.get('KITE_CONNECT_access_token');
        const kiteInstruments = await (0, kite_instruments_1.fetchInstruments)(process.env.KITE_API_KEY, kiteAccessToken);
        const structuredData = this.structureInstrumentData(jsonData, kiteInstruments); // Structure the data
        this.instrumentData = structuredData;
        console.log("dhan instrument data is loaded");
    }
    structureInstrumentData(jsonArray, kiteInstruments) {
        console.log(kiteInstruments, "length:", jsonArray.length);
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
        const isNifty50Option = /^NIFTY-[A-Za-z]{3}\d{4}-\d{5}-(CE|PE)$/;
        jsonArray.forEach(instrument => {
            const { name, symbol, strike, instrumenttype, exch_seg, token } = instrument;
            const angelExpiry = instrument.expiry;
            const instrument_type = instrumenttype;
            const tradingsymbol = symbol;
            const option_type = symbol.slice(-2); //extract from symbol
            const exchange = exch_seg;
            const expiry = convertDate(angelExpiry);
            // Index handling
            if (instrument_type === "AMXIDX" && exchange === "NSE") {
                if (symbol === "Nifty 50")
                    structuredData.NSE.INDEX.NIFTY = instrument;
                if (symbol === "Nifty Bank")
                    structuredData.NSE.INDEX.BANKNIFTY = instrument;
                if (name === "Nifty Fin Service")
                    structuredData.NSE.INDEX.FINNIFTY = instrument;
            }
            // Options handling
            // if(instrument_type === "OPTIDX" && exchange ==="NSE" && tradingsymbol.includes("BANKNIFTY")) console.log(name, instrument_type, tradingsymbol, option_type, expiry, strike, exchange, "\n", instrument);
            if (instrument_type === "OPTIDX" && exchange === "NFO") {
                if (option_type === "CE") {
                    const baseSymbol = tradingsymbol.slice(0, -2);
                    // Match CE with PE
                    jsonArray.forEach(otherInstrument => {
                        const tradingsymbol2 = otherInstrument.symbol;
                        const option_type2 = tradingsymbol2.slice(-2); //extr   act from symbol
                        // console.log(option_type, option_type2, tradingsymbol, tradingsymbol2);
                        // console.log("2nd, ",angelExpiry)
                        // const expiry2 = convertDate(angelExpiry);
                        if (option_type2 === "PE") {
                            const otherBaseSymbol = tradingsymbol2.slice(0, -2);
                            // console.log(otherBaseSymbol);
                            if (baseSymbol === otherBaseSymbol) {
                                if (tradingsymbol.includes("BANKNIFTY")) {
                                    // console.log(instrument, otherInstrument);
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
            else if (exchange === "NSE" && equity_symbols_1.equitySymbols.includes(tradingsymbol.slice(0, -3)) && tradingsymbol.slice(-2) === "EQ") {
                structuredData.NSE.EQUITY[tradingsymbol.slice(0, -3)] = instrument;
            }
        });
        kiteInstruments.map((instrument) => {
            if (instrument.segment === "NFO-OPT" && (instrument.name === "NIFTY" || instrument.name === "BANKNIFTY" || instrument.name === "FINNIFTY") && (instrument.instrument_type === "PE" || instrument.instrument_type === "CE") && structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`] && structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type]) {
                structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type].ltpToken = instrument.instrument_token;
                //add ltp token to subscribed instruments list
                // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                //create a map with symbol from broker as key and info from broker + info from kite as value
                const angelData = structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type];
                this.instrumentDataSearchMap[angelData.token] = Object.assign(Object.assign({}, angelData), instrument);
            }
            else if (instrument.segment === "INDICES" && instrument.exchange === "NSE" && (instrument.name === "NIFTY 50" || instrument.name === "NIFTY BANK" || instrument.name === "NIFTY FIN SERVICE")) {
                if (instrument.name === "NIFTY 50") {
                    structuredData.NSE.INDEX.NIFTY.ltpToken = instrument.instrument_token;
                    // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                }
                if (instrument.name === "NIFTY BANK") {
                    structuredData.NSE.INDEX.BANKNIFTY.ltpToken = instrument.instrument_token;
                    // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                }
                if (instrument.name === "NIFTY FIN SERVICE") {
                    structuredData.NSE.INDEX.FINNIFTY.ltpToken = instrument.instrument_token;
                    // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                }
            }
            else if (instrument.segment === "NSE" && instrument.instrument_type === "EQ" && structuredData.NSE.EQUITY[instrument.tradingsymbol]) {
                structuredData.NSE.EQUITY[instrument.tradingsymbol].ltpToken = instrument.instrument_token;
                // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
            }
        });
        return structuredData;
    }
    //////////////////////////////////////////
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
            let instrument = {};
            if (exchange === "BSE") {
                throw new Error('BSE not supported');
            }
            if (instrumentType === "OPT") {
                // console.log(this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.000000`][optionType]);
                instrument = this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}00.000000`][optionType];
                key = this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}00.000000`][optionType].token;
            }
            else if (instrumentType === "EQ") {
                instrument = this.instrumentData.NSE.EQUITY[baseInstrument];
                key = this.instrumentData.NSE.EQUITY[baseInstrument].token;
            }
            else if (instrumentType === "FUT") {
                throw new Error('Futures not supported');
            }
            else {
                throw new Error('Instrument type not supported');
            }
            const slicedQty = (0, order_slicer_1.sliceOrderQuantity)(qty, baseInstrument);
            const exchangeSegment = instrumentType === "OPT" ? "NFO" : "NSE";
            console.log(slicedQty);
            for (let i = 0; i < slicedQty.length; i++) {
                let config = {
                    method: 'post',
                    url: 'https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/placeOrder',
                    headers: {
                        'Authorization': `Bearer ${account.accessToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-UserType': 'USER',
                        'X-SourceID': 'WEB',
                        'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
                        'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
                        'X-MACAddress': 'MAC_ADDRESS',
                        'X-PrivateKey': account.key
                    },
                    data: {
                        variety: "NORMAL",
                        tradingsymbol: instrument.symbol,
                        symboltoken: instrument.token,
                        transactiontype: side,
                        exchange: exchangeSegment,
                        ordertype: orderType,
                        producttype: (productType === "I" || productType === "INTRADAY") ? "INTRADAY" : "CARRYFORWARD",
                        duration: "DAY",
                        price: orderType === "LIMIT" ? triggerPrice : 0,
                        squareoff: 0,
                        stoploss: 0,
                        quantity: slicedQty[i]
                    },
                };
                const response = await (0, axios_1.default)(config);
                // console.log(response);
                return response.data.data.orderid;
            }
            return true;
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
    // public async cancelOrder(accountId: string, orderId: string) {
    //     try {
    //         const accountManager = AccountManager.getInstance();
    //         const account = accountManager.getAuthenticatedAccountsAsObject(accountId);
    //         console.log(accountId, orderId, account);
    //         let config = {
    //             method: 'DELETE',
    //             url: `https://api.dhan.co/v2/orders/${orderId}`,
    //             headers: { 'access-token': account.accessToken, Accept: 'application/json' }
    //         };;
    //         const response = await axios(config)
    //         console.log(response.data);
    //         return response.data.data;
    //     } catch (error) {
    //         throw error;
    //     }
    // }
    async getOrderDetailsByOrderId(accountId, orderId) {
        try {
            const accountManager = accountsManager_1.AccountManager.getInstance();
            const account = accountManager.getAuthenticatedAccountsAsObject(accountId);
            let config = {
                method: 'get',
                url: 'https://apiconnect.angelone.in/rest/secure/angelbroking/order/v1/getOrderBook',
                headers: {
                    'Authorization': `Bearer ${account.accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-UserType': 'USER',
                    'X-SourceID': 'WEB',
                    'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
                    'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
                    'X-MACAddress': 'MAC_ADDRESS',
                    'X-PrivateKey': account.key
                },
            };
            const response = await (0, axios_1.default)(config);
            const orderBook = response.data.data;
            let selectedOrder = {};
            for (let i = 0; i < orderBook.length; i++) {
                if (orderBook[i].orderid === orderId) {
                    selectedOrder = {
                        symbolName: orderBook[i].tradingsymbol,
                        type: orderBook[i].ordertype,
                        side: orderBook[i].transactiontype,
                        qty: orderBook[i].quantity,
                        // remQty: orderBook[i].remainingQuantity,
                        remQty: 0,
                        orderPrice: orderBook[i].price,
                        tradedPrice: orderBook[i].averageprice,
                        triggerPrice: orderBook[i].triggerprice,
                        status: orderBook[i].status,
                        timeStamp: orderBook[i].updatetime,
                        orderId: orderBook[i].orderid,
                        message: orderBook[i].text || ""
                    };
                    break;
                }
            }
            console.log(selectedOrder);
            return selectedOrder;
        }
        catch (error) {
            throw error;
        }
    }
    // public async getPositions(access_token: string) {
    //     try {
    //         let config = {
    //             method: 'GET',
    //             url: 'https://api.dhan.co/v2/positions',
    //             headers: { 'access-token': access_token, Accept: 'application/json' }
    //         };
    //         const response = await axios(config)
    //         console.log("position from broker", response.data);
    //         let convertedPositions = response.data.map((position) => {
    //             const symbolDetails = this.instrumentDataSearchMap[position.securityId]
    //             return {
    //                 netQty: position.netQty,                       // Net Qty
    //                 symbolName: position.tradingSymbol,             // Symbol name
    //                 securityId: position.securityId,
    //                 baseInstrument: symbolDetails.name,                   // Base Instrument
    //                 instrumentType: symbolDetails.SEM_INSTRUMENT_NAME,       // Instrument Type
    //                 optionType: symbolDetails.SEM_INSTRUMENT_NAME === "OPTIDX" ? symbolDetails.instrument_type : null,              //option type
    //                 expiry: symbolDetails.expiry,                            // Expiry
    //                 strike: symbolDetails.strike,                  // Option Type
    //                 ltpToken: symbolDetails.ltpToken ? symbolDetails.ltpToken : null,                        // LTP Token
    //                 exchange: symbolDetails.exchange,                     // Exchange
    //                 action: null,                                    // Action (Buy/Sell based on qty)
    //                 pnl: 0,                               // PnL
    //                 ltp: position.last_price,                        // LTP
    //                 avgPrice: position.average_price,                // Avg Price
    //                 sl: null,                                        // SL (manual entry)
    //                 setSl: null,                                     // Set SL (manual entry)
    //                 target: null,                                    // Target (manual entry)
    //                 targetPrice: null,                               // Target Price (manual entry)
    //                 stopLoss: null,
    //                 multiplier: position.multiplier,                                 // Stop Loss (manual entry)
    //                 buyPrice: position.buyAvg,                    // Buy Price
    //                 sellPrice: position.sellAvg,
    //                 buyValue: position.dayBuyValue,                // Sell Price
    //                 sellValue: position.daySellValue,
    //                 buyQty: position.buyQty,               // Buy Qty
    //                 sellQty: position.sellQty,             // Sell Qty
    //                 realisedPnL: position.realizedProfit,                  // Realised P&L
    //                 unrealisedPnL: position.unrealizedProfit,              // Unrealised P&L
    //                 product: position.productType                        // Product
    //             }
    //         })
    //         console.log("cp", convertedPositions);
    //         return convertedPositions
    //     } catch (error) {
    //     }
    // }
    async getFunds(access_token, api_key) {
        console.log(api_key, access_token);
        var config = {
            method: 'get',
            url: 'https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/getRMS',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-UserType': 'USER',
                'X-SourceID': 'WEB',
                'X-ClientLocalIP': 'CLIENT_LOCAL_IP',
                'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
                'X-MACAddress': 'MAC_ADDRESS',
                'X-PrivateKey': api_key
            }
        };
        const resp = await (0, axios_1.default)(config);
        console.log(resp.data);
        return resp.data.data;
    }
}
exports.AngelOne = AngelOne;
AngelOne.instance = null;
//# sourceMappingURL=angel.service.js.map
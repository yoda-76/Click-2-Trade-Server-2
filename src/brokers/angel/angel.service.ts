import { ChildAccount, MasterAccount } from "@prisma/client";
import axios, { AxiosRequestConfig } from "axios";
import { AccountManager } from "../../core/accountsManager";
import { dbClient } from "../../utils/dbClient";
import { extractId } from "../../utils/extractId";
import fs from 'fs';
import path from 'path';
import { sliceOrderQuantity } from '../../utils/order-slicer';
import { OrderDetails } from 'Interface';
import { equitySymbols } from '../../constant/equity-symbols';
import { redisClient } from '../../lib/redis';
import { fetchInstruments } from '../../utils/kite-instruments';
import { json } from "express";


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


export class AngelOne {
    private static instance: AngelOne | null = null;
    private instrumentData: Record<string, any> = {};  // In-memory store for instrument data
    private instrumentDataSearchMap: Map<string, any> = new Map();  // In-memory store for instrument data
    private tokenToBeSubscribed: number[] = [];  // Token to be subscribed to for order updates


    // Singleton pattern
    private constructor() {
        this.loadInstrumentData();  // Load instruments when the broker is initialized
    }

    public static getInstance(): AngelOne {
        if (!AngelOne.instance) {
            AngelOne.instance = new AngelOne()
        }
        return AngelOne.instance;
    }


    public async handleWebhook(
        id: string,
        clientCode: string,
        password: string,
        totp: string): Promise<string> {
        try {
            const currentdate = new Date();
            const acc = extractId(id); // Function to extract ID and determine type (MASTER/CHILD)
            let user_id: string = "";
            let master_id: string = "";
            let userData: MasterAccount | ChildAccount;
            if (acc.type === "CHILD") {
                userData = await dbClient.getChildAccountByUid(acc.id);
                master_id = userData.master_id;
            } else if (acc.type === "MASTER") {
                userData = await dbClient.getMasterAccountByUid(acc.id);
                user_id = userData.user_id;
            } else {
                throw new Error("accountId might be wrong");
            }
            const privateKey = userData.key;
            //generate token 

            const data = JSON.stringify({
                clientcode: clientCode,
                password: password,
                totp: totp
            });

            const config: AxiosRequestConfig = {
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


            const response = await axios(config);
            console.log(response.data);
            if(!response.data.status) throw new Error(response.data.message);
            const access_token = response.data?.data?.jwtToken;

            const feedToken = response.data?.data?.feedToken;


            // Store the access token in-memory and update DB
            if (acc.type === "MASTER") {
                await dbClient.updateMasterAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
            } else {
                await dbClient.updateChildAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
            }
            const accountManager = AccountManager.getInstance();
            accountManager.addAuthenticatedAccount(user_id, master_id, "MASTER", userData.key, userData.broker_id, id, userData.id, access_token, "ANGEL");
            console.log("Access token for an Angel account stored successfully.", access_token, (typeof access_token));
            return `Access token for account ${id} stored successfully.`

        } catch (error) {
            console.error("Error in handleWebhook:", error);
            throw new Error(`Error authorizing with Angel : ${error.message}`);
        }
    }
    public getInstrumentDataAsObject() {
        return this.instrumentData;
    }

    public getInstrumentDataSearchMapAsObject() {
        console.log(this.instrumentDataSearchMap);
        return this.instrumentDataSearchMap;
    }

    private async loadInstrumentData() {
        // Load instruments from CSV file
        const rawInstrumentsDataDownloadLink = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";
        const filePath = path.join(__dirname,"..", "..","..","..", './instruments.JSON');

        // Function to download the CSV file
        const downloadCSV = async () => {
            try {
                const response = await axios.get(rawInstrumentsDataDownloadLink, {
                    responseType: 'stream', // Set response type to stream for downloading
                });
                console.log("json data downloaded")

                const writer = fs.createWriteStream(filePath);

                // Pipe the response data to the file
                response.data.pipe(writer);

                // Return a promise that resolves when the file is finished writing
                return new Promise((resolve, reject) => {
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                });
            } catch (error) {
                console.error('Error downloading the CSV file:', error);
            }
        };

        // Call the function to download the CSV
        await downloadCSV().catch((err) => {
            console.error('Failed to download CSV:', err);
        });
        console.log('json file downloaded and saved as instruments.json');
        const data = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(data);

        // fetch kite instruments
        const kiteAccessToken = await redisClient.get('KITE_CONNECT_access_token');
        const kiteInstruments = await fetchInstruments(process.env.KITE_API_KEY, kiteAccessToken);
        const structuredData = this.structureInstrumentData(jsonData, kiteInstruments);  // Structure the data
        this.instrumentData = structuredData
        // this.instrumentData = jsonData

        console.log("dhan instrument data is loaded");

    }

    private structureInstrumentData(jsonArray: any[], kiteInstruments: any[]): Record<string, any> {
        console.log(kiteInstruments, "length:", jsonArray.length);
        const structuredData: Record<string, any> = {
            "NSE": {
              "INDEX": {
                "NIFTY": {},
                "BANKNIFTY": {},
                "FINNIFTY": {},
              },
              "EQUITY": {},
              "BANKNIFTY": {},
              "FINNIFTY": {},
              "NIFTY": {}
            },
            "BSE": {
              "INDEX": {
                "BANKEX": {},
                "SENSEX": {}
              },
              "EQUITY": {},
              "BANKEX": {},
              "SENSEX": {}
            },
            "MCX": {
              "INDEX": {
                "CRUDEOIL": {}
              },
              "CRUDEOIL":{}
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
            if (instrument_type === "AMXIDX") {
                if (symbol === "Nifty 50") structuredData.NSE.INDEX.NIFTY = instrument;
                if (symbol === "Nifty Bank") structuredData.NSE.INDEX.BANKNIFTY = instrument;
                if (name === "Nifty Fin Service") structuredData.NSE.INDEX.FINNIFTY = instrument;
                if (name === "BANKEX") structuredData.BSE.INDEX.BANKEX = instrument;
                if (name === "SENSEX") structuredData.BSE.INDEX.SENSEX = instrument;

            }


            // {
            //     "token": "1147008",
            //     "symbol": "BANKEX24DEC60900CE",
            //     "name": "BANKEX",
            //     "expiry": "30DEC2024",
            //     "strike": "6090000.000000",
            //     "lotsize": "15",
            //     "instrumenttype": "OPTIDX",
            //     "exch_seg": "BFO",
            //     "tick_size": "5.000000"
            // },
            



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
            else if(instrument_type === "OPTIDX" && exchange === "BFO") {
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
                                if (tradingsymbol.includes("BANKEX")) {
                                    // console.log(instrument, otherInstrument);
                                    structuredData.BSE.BANKEX[`${expiry} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                                }
                                else if (tradingsymbol.includes("SENSEX")) {
                                    structuredData.BSE.SENSEX[`${expiry} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                                }
                            }
                        }
                    });
                }
            }
            else if ( exchange === "NSE" && equitySymbols.includes(tradingsymbol.slice(0,-3)) && tradingsymbol.slice(-2) === "EQ" ) {
                structuredData.NSE.EQUITY[tradingsymbol.slice(0,-3)] = instrument;
            }else if(exchange === "BSE" && equitySymbols.includes(tradingsymbol.slice(0,-3))){
                structuredData.BSE.EQUITY[tradingsymbol] = instrument;
            }
        });

        kiteInstruments.map((instrument) => {
            if (instrument.segment === "NFO-OPT" && (instrument.name === "NIFTY" || instrument.name === "BANKNIFTY" || instrument.name === "FINNIFTY") && (instrument.instrument_type === "PE" || instrument.instrument_type === "CE") && structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`] && structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type]) {
                structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type].ltpToken = instrument.instrument_token;

                const angelData = structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type];
                this.instrumentDataSearchMap[angelData.token] = { ...angelData, ...instrument };

            }else if(instrument.segment === "BFO-OPT" && (instrument.name === "BANKEX" || instrument.name === "SENSEX") && (instrument.instrument_type === "PE" || instrument.instrument_type === "CE") && structuredData.BSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`] && structuredData.BSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type]){
                structuredData.BSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type].ltpToken = instrument.instrument_token;
                //add ltp token to subscribed instruments list
                // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                //create a map with symbol from broker as key and info from broker + info from kite as value
                const angelData = structuredData.BSE[instrument.name][`${instrument.expiry} : ${instrument.strike}00.000000`][instrument.instrument_type];
                this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument}; 
                
              } else if( instrument.segment === "INDICES" ){
                if (instrument.name === "NIFTY 50") {
                  structuredData.NSE.INDEX.NIFTY.ltpToken = instrument.instrument_token;
                //   this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                  const angelData = structuredData.NSE.INDEX.NIFTY
                this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument}; 
          
                }
                else if (instrument.name === "NIFTY BANK"){
                  structuredData.NSE.INDEX.BANKNIFTY.ltpToken = instrument.instrument_token;
                //   this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                  const angelData = structuredData.NSE.INDEX.BANKNIFTY
                  this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument};
                }
                else if (instrument.name === "NIFTY FIN SERVICE") {
                  structuredData.NSE.INDEX.FINNIFTY.ltpToken = instrument.instrument_token;
                //   this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                  const angelData = structuredData.NSE.INDEX.FINNIFTY
                  this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument};
                }
                else if(instrument.name === "SENSEX") {
                  structuredData.BSE.INDEX.SENSEX.ltpToken = instrument.instrument_token;
                //   this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                  const angelData = structuredData.BSE.INDEX.SENSEX
                  this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument};
                }
                else if(instrument.name === "BSE INDEX BANKEX") {
                  structuredData.BSE.INDEX.BANKEX.ltpToken = instrument.instrument_token;
                //   this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                  const angelData = structuredData.BSE.INDEX.BANKEX
                  this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument};
                }else if(instrument.name === "MCXCRUDEX") {
                  structuredData.MCX.INDEX.CRUDEOIL.ltpToken = instrument.instrument_token;
                //   this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                  const angelData = structuredData.MCX.INDEX.CRUDEOIL
                  this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument};
                }
              } else if(instrument.instrument_type === "EQ" &&structuredData.NSE.EQUITY[instrument.tradingsymbol]){
                if(instrument.segment === "NSE"){
                  structuredData.NSE.EQUITY[instrument.tradingsymbol].ltpToken = instrument.instrument_token;
                //   this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                  const angelData = structuredData.NSE.EQUITY[instrument.tradingsymbol]
                  this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument};
                }
                // TODO: BSE EQ

                // else if(instrument.segment === "BSE" &&instrument.tradingsymbol==="TITANBIO"){
                //     console.log(instrument.tradingsymbol, structuredData.BSE.EQUITY[instrument.tradingsymbol])
                //   structuredData.BSE.EQUITY[instrument.tradingsymbol].ltpToken = instrument.instrument_token;
                // //   this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
                //   const angelData = structuredData.BSE.EQUITY[instrument.tradingsymbol]
                //   this.instrumentDataSearchMap[angelData.tradingsymbol] ={...angelData, ...instrument};
                // }
              }
        })

        return structuredData;
    }

    //////////////////////////////////////////

    public async placeOrder(accountId: string, orderDetails: OrderDetails) {

        //check funds first
        try {
            const accountManager = AccountManager.getInstance();
            const account = accountManager.getAuthenticatedAccountsAsObject(accountId);
            // const account = UpstoxBroker.authenticatedAccounts.get(accountId);
            console.log(account);
            if (!account) {
                throw new Error('Account not authenticated');
            }
            const { baseInstrument, instrumentType, expiry, strike, optionType, exchange, qty, price, triggerPrice, orderType, side, productType } = orderDetails;
            console.log(orderDetails);
            let key = "";
            let instrument: any = {};
            // if (exchange === "BSE") {
            //     throw new Error('BSE not supported');
            // }
            if (instrumentType === "IDX-OPT") {
                // console.log(this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.000000`][optionType]);
                if (exchange === "NSE") {
                    instrument = this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}00.000000`][optionType];
                key = this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}00.000000`][optionType].token
            }else if(exchange === "BSE") {
                instrument = this.instrumentData.BSE[baseInstrument][`${expiry} : ${strike}00.000000`][optionType];
                key = this.instrumentData.BSE[baseInstrument][`${expiry} : ${strike}00.000000`][optionType].token
                
            }
            
        } else if (instrumentType === "EQ") {
            instrument = this.instrumentData.NSE.EQUITY[baseInstrument];
            key = this.instrumentData.NSE.EQUITY[baseInstrument].token
        } else if (instrumentType === "IDX-FUT") {
            throw new Error('Futures not supported');
        } else {
            throw new Error('Instrument type not supported');
        }
        
        console.log(instrument, key);
            const slicedQty = sliceOrderQuantity(qty, baseInstrument);
            const exchangeSegment = instrumentType === "IDX-OPT" ? "NFO" : "NSE";


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
                        variety:"AMO",
                        tradingsymbol:instrument.symbol,
                        symboltoken:instrument.token,
                        transactiontype:side,
                        exchange: exchangeSegment,
                        ordertype:orderType,
                        producttype:(productType === "I" || productType === "INTRADAY") ? "INTRADAY" : "CARRYFORWARD",
                        duration:"DAY",
                        price:orderType === "LIMIT" ? triggerPrice : 0,
                        squareoff:0,
                        stoploss:0,
                        quantity:slicedQty[i]
                        },
                };

                const response = await axios(config);
                console.log(response);
                return response.data.data.orderid;
            }
            return true;
        } catch (error) {
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

    public async getOrderDetailsByOrderId(accountId: string, orderId: string) {
        try {
            const accountManager = AccountManager.getInstance();
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

            const response = await axios(config)
            const orderBook = response.data.data;
            let selectedOrder = {}

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
            return selectedOrder
        } catch (error) {
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


    public async getFunds(access_token: string, api_key: string): Promise<any> {
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
        const resp = await axios(config)
        console.log(resp.data);
        return resp.data.data;
    }

    // public async getTrades(access_token: string): Promise<any> {
    //     let config = {
    //         method: 'GET',
    //         url: 'https://api.dhan.co/v2/trades',
    //         headers: { 'access-token': access_token, Accept: 'application/json' }
    //     };

    //     const response = await axios(config)
    //     return response.data.data
    // }

}







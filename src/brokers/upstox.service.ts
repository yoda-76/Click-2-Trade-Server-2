import axios from 'axios';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import csvtojson from 'csvtojson';
import { extractId } from '../utils/extractId';
import { ChildAccount, MasterAccount } from '@prisma/client';
import { dbClient } from '../utils/dbClient';
import {AccountManager} from '../core/accountsManager';
import { sliceOrderQuantity } from '../utils/order-slicer';
import { OrderDetails } from 'Interface';
import { equitySymbols } from '../constant/equity-symbols';
import { redisClient } from '../lib/redis';
import { fetchInstruments } from '../utils/kite-instruments';
import { extractOptionDetails } from '../utils/extract-option-details';

export class UpstoxBroker {
  private static authenticatedAccounts: Map<string, { accessToken: string, expiresAt: Date }> = new Map();
  private static instance: UpstoxBroker | null = null;
  private instrumentData: Record<string, any> = {};  // In-memory store for instrument data
  private tokenToBeSubscribed: number[] = [];  // Token to be subscribed to for order updates
  private instrumentDataSearchMap: Map<string, any> = new Map();  // In-memory store for instrument data

  // Singleton pattern
  private constructor() {
    this.loadInstrumentData();  // Load instruments when the broker is initialized
  }

  public static getInstance(): UpstoxBroker {
    if (!UpstoxBroker.instance) {
      UpstoxBroker.instance = new UpstoxBroker();
    }
    return UpstoxBroker.instance;
  }

  public getInstrumentDataAsObject() {
    // console.log(this.instrumentData);
    return this.instrumentData;
  }

  public getInstrumentDataSearchMapAsObject() {
    console.log(this.instrumentDataSearchMap);
    return this.instrumentDataSearchMap;
  }

  // Handle access token received via webhook
  public async handleWebhook(id: string, authcode: string): Promise<string> {
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
        throw new Error( "Error authorizing with Upstox : .Controllers/Authorization: handleWebhook");
      }
      // Fetch access token using the authorization code
      const response = await axios.post(
        "https://api.upstox.com/v2/login/authorization/token",
        new URLSearchParams({
          code: authcode,
          client_id: userData.key,
          client_secret: userData.secret,
          redirect_uri: "https://api.cliq2trade.com/api/upstox/auth",
          grant_type: "authorization_code",
        }),
        {
          headers: {
            Accept: "application/json",
            "Api-Version": "2.0",
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      // Process the response
      const access_token: string = response.data.access_token;
      let account;
      // Store the access token in-memory and update DB
      const accountManager = AccountManager.getInstance();
      if (acc.type === "MASTER") {
        await dbClient.updateMasterAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
      accountManager.addAuthenticatedAccount(user_id, master_id, "MASTER", userData.key, userData.broker_id, id, userData.id, access_token, "UPSTOCKS");

      } else {
        await dbClient.updateChildAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
      accountManager.addAuthenticatedAccount(user_id, master_id, "CHILD", userData.key, userData.broker_id, id, userData.id, access_token, "UPSTOCKS");

      }
      // Get the singleton instance of AccountManager and add the account
      console.log("Access token for account stored successfully.");
      return `Access token for account ${id} stored successfully.`
    } catch (error) {
      console.error("Error in handleWebhook:", error);
      throw new Error("Error authorizing with Upstox : .Controllers/Authorization: handleWebhook");
    }
  }


  public isAuthenticated(accountId: string): boolean {
    const account = UpstoxBroker.authenticatedAccounts.get(accountId);
    if (!account) return false;

    const now = new Date();
    return account.expiresAt > now;
  }

  

  // Place order using the access token
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
        let key="";
        if(exchange === "BSE"){
          throw new Error('BSE not supported');
        }
        if(instrumentType === "OPT"){
          console.log(this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.0`][optionType]);
          key=  this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.0`][optionType].instrument_key
        }else if(instrumentType === "EQ"){
          key=  this.instrumentData.NSE.EQUITY[baseInstrument].instrument_key
        }else if(instrumentType === "FUT"){
          throw new Error('Futures not supported');
        }else{ 
          throw new Error('Instrument type not supported');
        }

        const slicedQty = sliceOrderQuantity(qty, baseInstrument);
    

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
              product: productType,
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
    
          const response = await axios(config);
          console.log(response);
          return response.data.data.order_id;
        }
        return true;
      } catch (error) {
        console.log(error);
        throw error;
      }
  }

  public async cancelOrder(accountId: string, orderId: string) {
    try {
      const accountManager = AccountManager.getInstance();
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

      const response = await axios(config)
      return response.data.data;
    } catch (error) {
      throw error;
    }
  }

  public async getOrderDetailsByOrderId(accountId: string, orderId: string) {
    try {
      const accountManager = AccountManager.getInstance();
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

      const response = await axios(config)
      // before returning convert to base 
      // const t2 = {
      //   symbolName:"",
      //   type:"",
      //   side:"",
      //   qty:"",
      //   remQty:"",
      //   orderPrice:"",
      //   tradedPrice:"",
      //   triggerPrice:"",
      //   status:"",
      //   timeStamp: "",
      //   orderId:"",
      //   message:""
      // }
      // const t={
      //   "exchange": "NSE",
      //   "product": "D",
      //   "price": 0,
      //   "quantity": 15,
      //   "status": "after market order req received",
      //   "guid": null,
      //   "tag": "string",
      //   "instrument_token": "NSE_EQ|INE263A01024",
      //   "placed_by": "KL2770",
      //   "tradingsymbol": "BEL-EQ",
      //   "trading_symbol": "BEL-EQ",
      //   "order_type": "MARKET",
      //   "validity": "DAY",
      //   "trigger_price": 0,
      //   "disclosed_quantity": 0,
      //   "transaction_type": "BUY",
      //   "average_price": 0,
      //   "filled_quantity": 0,
      //   "pending_quantity": 15,
      //   "status_message": null,
      //   "status_message_raw": null,
      //   "exchange_order_id": "",
      //   "parent_order_id": null,
      //   "order_id": "240929000003371",
      //   "variety": "SIMPLE",
      //   "order_timestamp": "2024-09-29 19:33:47",
      //   "exchange_timestamp": null,
      //   "is_amo": true,
      //   "order_request_id": "1",
      //   "order_ref_id": "UDAPI-I-Z5wPHeGizhJlIkt7DJpUDTFf"
      // }
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
      return convertedOrderbook
    } catch (error) {
      throw error;
    }
  }


  public async getPositions(access_token: string) {
      try {
        console.log("at",access_token);
        let config = {
          method: 'get',
        maxBodyLength: Infinity,
          url: 'https://api.upstox.com/v2/portfolio/short-term-positions',
          headers: { 
            Accept: "application/json",
            Authorization: `Bearer ${access_token}`,
          }
        };
        const response = await axios(config)
        console.log("position from broker",response.data.data);
        let convertedPositions = response.data.data.map((position) => {
          const symbolName = position.trading_symbol
          const symbolDetails = this.instrumentDataSearchMap[symbolName]
          return {
            netQty: position.quantity,                       // Net Qty
            symbolName: position.trading_symbol,             // Symbol name
            baseInstrument: symbolDetails.name,                   // Base Instrument
            instrumentType: symbolDetails.instrument_type,       // Instrument Type
            optionType: symbolDetails.option_type,              //option type
            expiry: symbolDetails.expiry,                            // Expiry
            strike: symbolDetails.strike,                  // Option Type
            ltpToken: symbolDetails.ltpToken?symbolDetails.ltpToken:null,                        // LTP Token
            exchange: symbolDetails.exchange,                     // Exchange
            action: null,                                    // Action (Buy/Sell based on qty)
            pnl: position.pnl,                               // PnL
            ltp: position.last_price,                        // LTP
            avgPrice: position.average_price,                // Avg Price
            sl: null,                                        // SL (manual entry)
            setSl: null,                                     // Set SL (manual entry)
            target: null,                                    // Target (manual entry)
            targetPrice: null,                               // Target Price (manual entry)
            stopLoss: null,    
            multiplier: position.multiplier,                              // Stop Loss (manual entry)
            buyPrice: position.buy_price,                    // Buy Price
            sellPrice: position.sell_price,                  // Sell Price
            buyQty: position.day_buy_quantity,               // Buy Qty
            sellQty: position.day_sell_quantity,             // Sell Qty
            realisedPnL: position.realised,                  // Realised P&L
            unrealisedPnL: position.unrealised,              // Unrealised P&L
            product: position.product                        // Product
          }
        })
        console.log("cp",convertedPositions);
        return convertedPositions
      } catch (error) {
        
      }
  }

  public async getPositionByOrderDetails(accountId: string, orderDetails: OrderDetails) {
    try {
      const accountManager = AccountManager.getInstance();
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
      
      const response = await axios(config)
      console.log("positions from broker", response.data.data);
      let position;
      let instrumentDetails;
      if(orderDetails.exchange === "BSE"){
        throw new Error('BSE not supported');
      }
      if(orderDetails.instrumentType === "OPT"){
        instrumentDetails=  this.instrumentData.NSE[orderDetails.baseInstrument][`${orderDetails.expiry} : ${orderDetails.strike}.0`][orderDetails.optionType]
      }else if(orderDetails.instrumentType === "EQ"){
        instrumentDetails=  this.instrumentData.NSE.EQUITY[orderDetails.baseInstrument]
      }else if(orderDetails.instrumentType === "FUT"){
        throw new Error('Futures not supported');
      }else{ 
        throw new Error('Instrument type not supported');
      }
      response.data.data.map((p: any) => {
        if(p.trading_symbol === instrumentDetails.tradingsymbol) {
          position = p
        }
      })
      console.log({orderDetails,position, instrumentDetails});
      const convertedPosition = {
        netQty: position.quantity,                       // Net Qty
        symbolName: position.trading_symbol,             // Symbol name
        baseInstrument: instrumentDetails.base,                   // Base Instrument
        instrumentType: instrumentDetails.instrument_type,       // Instrument Type
        expiry: instrumentDetails.expiry,                            // Expiry
        strike: instrumentDetails.strike,                             // Strike
        optionType: orderDetails.optionType,                   // Option Type
        ltpToken: instrumentDetails.ltpToken?instrumentDetails.ltpToken:null,                        // LTP Token
        exchange: position.exchange==="NFO" || position.exchange==="NSE"?"NSE":null,                     // Exchange
        action: null,                                    // Action (Buy/Sell based on qty)
        pnl: position.pnl,                               // PnL
        ltp: position.last_price,                        // LTP
        avgPrice: position.average_price,                // Avg Price
        sl: null,                                        // SL (manual entry)
        setSl: null,                                     // Set SL (manual entry)
        target: null,                                    // Target (manual entry)
        setTarget: null,                                 // Set Target (manual entry)
        buyPrice: position.buy_price,                    // Buy Price
        sellPrice: position.sell_price,                  // Sell Price
        buyQty: position.day_buy_quantity,               // Buy Qty
        sellQty: position.day_sell_quantity,             // Sell Qty
        realisedPnL: position.realised,                  // Realised P&L
        unrealisedPnL: position.unrealised,              // Unrealised P&L
        product: position.product                        // Product
      };
      console.log("converted position", convertedPosition);
      return convertedPosition
    }catch (error) {
      throw error;
    }
  }
  // Load instrument data into memory
  private async loadInstrumentData() {
    try {
      const folderPath = path.join(__dirname, 'token_data');
      const compressedFilePath = path.join(folderPath, 'instrument_data.csv.gz');
      const decompressedFilePath = path.join(folderPath, 'instrument_data.csv');
      
      // Ensure the directory exists
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }

      // Download and decompress instrument data
      await axios({
        method: 'get',
        url: 'https://assets.upstox.com/market-quote/instruments/exchange/complete.csv.gz',
        responseType: 'stream',
      }).then((response) => {
        const writer = fs.createWriteStream(compressedFilePath);
        response.data.pipe(writer);
        return new Promise<void>((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });
      });

      // Decompress file
      await new Promise<void>((resolve, reject) => {
        const input = fs.createReadStream(compressedFilePath);
        const output = fs.createWriteStream(decompressedFilePath);
        input.pipe(zlib.createGunzip()).pipe(output);
        output.on('finish', resolve);
        output.on('error', reject);
      });

      // Convert CSV to JSON and structure data
      const jsonArray = await csvtojson().fromFile(decompressedFilePath);

      //fetch kite instruments
      const kiteAccessToken = await redisClient.get('KITE_CONNECT_access_token');
      const kiteInstruments = await fetchInstruments(process.env.KITE_API_KEY, kiteAccessToken);
      this.instrumentData = this.structureInstrumentData(jsonArray, kiteInstruments);  // Structure the data

      console.log('Instrument data loaded into memory and structured');
    } catch (error) {
      console.error('Error loading instrument data:', error.message || error);
    }
  }
  
  // Structure instrument data for quick access
  private structureInstrumentData(jsonArray: any[], kiteInstruments: any[]): Record<string, any> {
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
        "NIFTY": {},
      }
    };

    const isNifty50Option = /^NIFTY\d{2}([A-Z]{3}|\d{3})\d{5}(CE|PE)$/;

    jsonArray.forEach(instrument => {
      const { name, instrument_type, tradingsymbol, option_type, expiry, strike, exchange } = instrument;

      // Index handling
      if (instrument_type === "INDEX") {
        if (name === "Nifty 50") structuredData.NSE.INDEX.NIFTY = instrument;
        if (name === "Nifty Bank") structuredData.NSE.INDEX.BANKNIFTY = instrument;
        if (name === "Nifty Fin Service") structuredData.NSE.INDEX.FINNIFTY = instrument;
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
                } else if (tradingsymbol.includes("FINNIFTY")) {
                  structuredData.NSE.FINNIFTY[`${expiry} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                } else if (isNifty50Option.test(tradingsymbol)) {
                  structuredData.NSE.NIFTY[`${expiry} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                }
              }
            }
          });
        }
      }else if(instrument_type === "EQUITY" && exchange === "NSE_EQ" && equitySymbols.includes(tradingsymbol)){
        structuredData.NSE.EQUITY[tradingsymbol] = instrument;
      }
    });

    kiteInstruments.map((instrument) => {
      if(instrument.segment === "NFO-OPT" && (instrument.name === "NIFTY" || instrument.name === "BANKNIFTY" || instrument.name === "FINNIFTY") && (instrument.instrument_type === "PE" || instrument.instrument_type === "CE") &&structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.0`] && structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.0`][instrument.instrument_type]){
        structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.0`][instrument.instrument_type].ltpToken = instrument.instrument_token;

        //add ltp token to subscribed instruments list
        this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
        //create a map with symbol from broker as key and info from broker + info from kite as value
        const upstoxData = structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.0`][instrument.instrument_type];
        this.instrumentDataSearchMap[upstoxData.tradingsymbol] ={...upstoxData, ...instrument}; 
        
      }else if( instrument.segment === "INDICES" && instrument.exchange === "NSE" && (instrument.name === "NIFTY 50" || instrument.name === "NIFTY BANK" || instrument.name === "NIFTY FIN SERVICE")){
        if (instrument.name === "NIFTY 50") {
          structuredData.NSE.INDEX.NIFTY.ltpToken = instrument.instrument_token;
          this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
        }
        if (instrument.name === "NIFTY BANK"){
          structuredData.NSE.INDEX.BANKNIFTY.ltpToken = instrument.instrument_token;
          this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
        }
        if (instrument.name === "NIFTY FIN SERVICE") {
          structuredData.NSE.INDEX.FINNIFTY.ltpToken = instrument.instrument_token;
          this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
        }
      }else if(instrument.segment === "NSE" && instrument.instrument_type === "EQ" &&structuredData.NSE.EQUITY[instrument.tradingsymbol]){
        structuredData.NSE.EQUITY[instrument.tradingsymbol].ltpToken = instrument.instrument_token;
        this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
        

      }
    })

    return structuredData;
  }

  // Get instrument from memory
  public getInstrument(base: string, expiry: string, strike: number, side: string): any {
    return this.instrumentData?.[base]?.[`${expiry} : ${strike}`]?.[side] || null;
  }

  public getTokensToBeSubscribed() {
    return this.tokenToBeSubscribed;
  }

  //Get funds of an upstox account
  public async getFunds(access_token: string): Promise<any> {
    const url = "https://api.upstox.com/v2/user/get-funds-and-margin";

    const headers = {
      Accept: "application/json",
      Authorization: `Bearer ${access_token}`,
    };
    const resp = await axios.get(url, { headers })
    console.log(resp);
    return resp.data.data;
  }

  public async getTrades(access_token: string): Promise<any> {
    let config = {
      method: 'get',
    maxBodyLength: Infinity,
      url: 'https://api.upstox.com/v2/order/trades/get-trades-for-day',
      headers: { 
        Accept: "application/json",
        Authorization: `Bearer ${access_token}`,
      }
    };
    
    const response = await axios(config)
    return response.data.data
  }
}

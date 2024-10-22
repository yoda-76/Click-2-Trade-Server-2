import axios from 'axios';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import csvtojson from 'csvtojson';
import { extractId } from '../../utils/extractId';
import { ChildAccount, MasterAccount } from '@prisma/client';
import { dbClient } from '../../utils/dbClient';
import {AccountManager} from '../../core/accountsManager';
import { sliceOrderQuantity } from '../../utils/order-slicer';
import { OrderDetails } from 'Interface';
import { equitySymbols } from '../../constant/equity-symbols';
import { redisClient } from '../../lib/redis';
import { fetchInstruments } from '../../utils/kite-instruments';
import { extractOptionDetails } from '../../utils/extract-option-details';

export class DhanBroker {
    private static instance: DhanBroker | null = null;
    private instrumentData: Record<string, any> = {};  // In-memory store for instrument data
    private instrumentDataSearchMap: Map<string, any> = new Map();  // In-memory store for instrument data
    // private tokenToBeSubscribed: number[] = [];  // Token to be subscribed to for order updates


    // Singleton pattern
    private constructor() {
      this.loadInstrumentData();  // Load instruments when the broker is initialized
    }

    public static getInstance(): DhanBroker {
      if (!DhanBroker.instance) {
        DhanBroker.instance = new DhanBroker();
      }
      return DhanBroker.instance;
    }


    public async handleWebhook(id: string, access_token: string, dhanClientId: string): Promise<string> {
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
          throw new Error( "accountId might be wrong");
        }
        
        // Store the access token in-memory and update DB
        if (acc.type === "MASTER") {
          await dbClient.updateMasterAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
        } else {
          await dbClient.updateChildAccessTokenByUid(acc.id, { access_token, last_token_generated_at: currentdate });
        }
        const accountManager = AccountManager.getInstance();
        accountManager.addAuthenticatedAccount(user_id, master_id, "MASTER", userData.key, userData.broker_id, id, userData.id, access_token, "DHAN", dhanClientId);
        console.log("Access token for account stored successfully.");
        return `Access token for account ${id} stored successfully.`
      } catch (error) {
        console.error("Error in handleWebhook:", error);
        throw new Error(`Error authorizing with Dhan : ${error.message}`);
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
      const rawInstrumentsDataDownloadLink = "https://images.dhan.co/api-data/api-scrip-master.csv";
      const filePath = path.join(__dirname, './instruments.csv');
      
      // Function to download the CSV file
      const downloadCSV = async () => {
          try {
              const response = await axios.get(rawInstrumentsDataDownloadLink, {
                  responseType: 'stream', // Set response type to stream for downloading
              });
      
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
      await downloadCSV()
      console.log('CSV file downloaded and saved as instruments.csv');
      const fileStream = fs.createReadStream(filePath);
      const jsonArray = await csvtojson().fromFile(filePath);
      // console.log(jsonArray);
      
      // fetch kite instruments
      const kiteAccessToken = await redisClient.get('KITE_CONNECT_access_token');
      const kiteInstruments = await fetchInstruments(process.env.KITE_API_KEY, kiteAccessToken);
      const structuredData = this.structureInstrumentData(jsonArray, kiteInstruments);  // Structure the data
      this.instrumentData = structuredData
      console.log("dhan instrument data is loaded");

    }

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
  
      const isNifty50Option = /^NIFTY-[A-Za-z]{3}\d{4}-\d{5}-(CE|PE)$/;
  
      jsonArray.forEach(instrument => {
        const { SEM_INSTRUMENT_NAME, SEM_EXCH_INSTRUMENT_TYPE, SEM_TRADING_SYMBOL, SEM_OPTION_TYPE, SEM_EXPIRY_DATE, SEM_STRIKE_PRICE, SEM_EXM_EXCH_ID, SEM_CUSTOM_SYMBOL, SM_SYMBOL_NAME } = instrument;
        const name = SM_SYMBOL_NAME;
        const instrument_type = SEM_INSTRUMENT_NAME;
        const tradingsymbol = SEM_TRADING_SYMBOL;
        const option_type = SEM_OPTION_TYPE;
        const expiry = SEM_EXPIRY_DATE;
        const strike = SEM_STRIKE_PRICE;
        const exchange = SEM_EXM_EXCH_ID;
  
        // Index handling
        if (instrument_type === "INDEX" && exchange === "NSE") {
          if (name === "NIFTY") structuredData.NSE.INDEX.NIFTY = instrument;
          if (name === "BANKNIFTY") structuredData.NSE.INDEX.BANKNIFTY = instrument;
          if (name === "NIFTY FIN SERVICE") structuredData.NSE.INDEX.FINNIFTY = instrument;
        }
        
        // Options handling
        // if(instrument_type === "OPTIDX" && exchange ==="NSE" && tradingsymbol.includes("BANKNIFTY")) console.log(name, instrument_type, tradingsymbol, option_type, expiry, strike, exchange, "\n", instrument);
        if (instrument_type === "OPTIDX" && exchange === "NSE") {
          if (option_type === "CE") {
            const baseSymbol = tradingsymbol.slice(0, -2);
            // Match CE with PE
            jsonArray.forEach(otherInstrument => {
            const { SEM_INSTRUMENT_NAME, SEM_EXCH_INSTRUMENT_TYPE, SEM_TRADING_SYMBOL, SEM_OPTION_TYPE, SEM_EXPIRY_DATE, SEM_STRIKE_PRICE, SEM_EXM_EXCH_ID, SEM_CUSTOM_SYMBOL, SM_SYMBOL_NAME } = otherInstrument;

            const name2 = SM_SYMBOL_NAME;
            const instrument_type2 = SEM_INSTRUMENT_NAME;
            const tradingsymbol2 = SEM_TRADING_SYMBOL;
            const option_type2 = SEM_OPTION_TYPE;
            const expiry2 = SEM_EXPIRY_DATE;
            const strike2 = SEM_STRIKE_PRICE;
            const exchange2 = SEM_EXM_EXCH_ID;
            if (option_type2 === "PE") {
              const otherBaseSymbol = tradingsymbol2.slice(0, -2);
              // console.log(otherBaseSymbol);

              if (baseSymbol === otherBaseSymbol) {
                if (tradingsymbol.includes("BANKNIFTY")) {
                  // console.log(instrument, otherInstrument);
                  structuredData.NSE.BANKNIFTY[`${expiry.split(" ")[0]} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                } 
                else if (tradingsymbol.includes("FINNIFTY")) {
                  structuredData.NSE.FINNIFTY[`${expiry.split(" ")[0]} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                } 
                else if (isNifty50Option.test(tradingsymbol)) {
                  structuredData.NSE.NIFTY[`${expiry.split(" ")[0]} : ${strike}`] = { CE: instrument, PE: otherInstrument };
                }
              }
            }
            });
          }
        }
        else if(instrument_type === "EQUITY" && exchange === "NSE" && equitySymbols.includes(tradingsymbol)){
          structuredData.NSE.EQUITY[tradingsymbol] = instrument;
        }
      });
  
      kiteInstruments.map((instrument) => {
        if(instrument.segment === "NFO-OPT" && (instrument.name === "NIFTY" || instrument.name === "BANKNIFTY" || instrument.name === "FINNIFTY") && (instrument.instrument_type === "PE" || instrument.instrument_type === "CE") &&structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.00000`] && structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.00000`][instrument.instrument_type]){
          structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.00000`][instrument.instrument_type].ltpToken = instrument.instrument_token;
  
          //add ltp token to subscribed instruments list
          // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
          //create a map with symbol from broker as key and info from broker + info from kite as value
          const dhanData = structuredData.NSE[instrument.name][`${instrument.expiry} : ${instrument.strike}.00000`][instrument.instrument_type];
          this.instrumentDataSearchMap[dhanData.SEM_SMST_SECURITY_ID] ={...dhanData, ...instrument}; 
          
        }else if( instrument.segment === "INDICES" && instrument.exchange === "NSE" && (instrument.name === "NIFTY 50" || instrument.name === "NIFTY BANK" || instrument.name === "NIFTY FIN SERVICE")){
          if (instrument.name === "NIFTY 50") {
            structuredData.NSE.INDEX.NIFTY.ltpToken = instrument.instrument_token;
            // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
          }
          if (instrument.name === "NIFTY BANK"){
            structuredData.NSE.INDEX.BANKNIFTY.ltpToken = instrument.instrument_token;
            // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
          }
          if (instrument.name === "NIFTY FIN SERVICE") {
            structuredData.NSE.INDEX.FINNIFTY.ltpToken = instrument.instrument_token;
            // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
          }
        }else if(instrument.segment === "NSE" && instrument.instrument_type === "EQ" &&structuredData.NSE.EQUITY[instrument.tradingsymbol]){
          structuredData.NSE.EQUITY[instrument.tradingsymbol].ltpToken = instrument.instrument_token;
          // this.tokenToBeSubscribed.push(Number(instrument.instrument_token));
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
        let key="";
        let instrument: any = {};
        if(exchange === "BSE"){
          throw new Error('BSE not supported');
        }
        if(instrumentType === "OPT"){
          // console.log(this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.00000`][optionType]);
          instrument = this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.00000`][optionType];
          key=  this.instrumentData.NSE[baseInstrument][`${expiry} : ${strike}.00000`][optionType].SEM_SMST_SECURITY_ID
        }else if(instrumentType === "EQ"){
          instrument = this.instrumentData.NSE.EQUITY[baseInstrument];
          key=  this.instrumentData.NSE.EQUITY[baseInstrument].SEM_SMST_SECURITY_ID
        }else if(instrumentType === "FUT"){
          throw new Error('Futures not supported');
        }else{ 
          throw new Error('Instrument type not supported');
        }

        const slicedQty = sliceOrderQuantity(qty, baseInstrument);
        const exchangeSegment = instrumentType === "OPT"? "NSE_FNO" : "NSE_EQ";
        

        console.log(slicedQty);
        for (let i = 0; i < slicedQty.length; i++) {
          let config = {
            method: 'POST',
            url: 'https://api.dhan.co/orders',
            headers: {
              'access-token': account.accessToken,
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            data: {
              dhanClientId: account.dhanClientId,
              transactionType: side,
              exchangeSegment,
              productType: (productType==="I" || productType==="INTRADAY")?"INTRADAY":"MARGIN",
              orderType,
              validity: 'DAY',
              tradingSymbol: instrument.SEM_TRADING_SYMBOL,
              securityId: key,
              quantity: slicedQty[i],
              disclosedQuantity: 0,
              price: orderType==="LIMIT"?triggerPrice:0,
              // afterMarketOrder: true
            }
          };

          const response = await axios(config);
          console.log(response);
          return response.data.orderId;
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
      
      console.log(accountId, orderId, account);
      let config = {
        method: 'DELETE',
        url: `https://api.dhan.co/v2/orders/${orderId}`,
        headers: {'access-token': account.accessToken, Accept: 'application/json'}
      };;

      const response = await axios(config)
      console.log(response.data);
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
        method: 'GET',
        url: `https://api.dhan.co/v2/orders/${orderId}`,
        headers: {'access-token': access_token, Accept: 'application/json'}
      };

      const response = await axios(config)
      console.log(response.data);
      const convertedOrderbook = {
        symbolName: response.data[0].tradingSymbol,
        type: response.data[0].orderType,
        side: response.data[0].transactionType,
        qty: response.data[0].quantity,
        remQty: response.data[0].remainingQuantity,
        orderPrice: response.data[0].price,
        tradedPrice: response.data[0].averageTradedPrice,
        triggerPrice: response.data[0].triggerPrice,
        status: response.data[0].orderStatus,
        timeStamp: response.data[0].createTime,
        orderId: response.data[0].orderId,
        message: response.data[0].omsErrorDescription || ""
      };
      return convertedOrderbook
    } catch (error) {
      throw error;
    }
  }


  public async getPositions(access_token: string) {
      try {
        let config = {
          method: 'GET',
          url: 'https://api.dhan.co/v2/positions',
          headers: {'access-token': access_token, Accept: 'application/json'}
        };
        const response = await axios(config)
        console.log("position from broker",response.data);
        let convertedPositions = response.data.map((position) => {
          const symbolDetails = this.instrumentDataSearchMap[position.securityId]
          return {
            netQty: position.netQty,                       // Net Qty
            symbolName: position.tradingSymbol,             // Symbol name
            securityId: position.securityId,
            baseInstrument: symbolDetails.name,                   // Base Instrument
            instrumentType: symbolDetails.SEM_INSTRUMENT_NAME,       // Instrument Type
            optionType: symbolDetails.SEM_INSTRUMENT_NAME==="OPTIDX"?symbolDetails.instrument_type:null,              //option type
            expiry: symbolDetails.expiry,                            // Expiry
            strike: symbolDetails.strike,                  // Option Type
            ltpToken: symbolDetails.ltpToken?symbolDetails.ltpToken:null,                        // LTP Token
            exchange: symbolDetails.exchange,                     // Exchange
            action: null,                                    // Action (Buy/Sell based on qty)
            pnl: 0,                               // PnL
            ltp: position.last_price,                        // LTP
            avgPrice: position.average_price,                // Avg Price
            sl: null,                                        // SL (manual entry)
            setSl: null,                                     // Set SL (manual entry)
            target: null,                                    // Target (manual entry)
            targetPrice: null,                               // Target Price (manual entry)
            stopLoss: null, 
            multiplier: position.multiplier,                                 // Stop Loss (manual entry)
            buyPrice: position.buyAvg,                    // Buy Price
            sellPrice: position.sellAvg,  
            buyValue: position.dayBuyValue,                // Sell Price
            sellValue: position.daySellValue,
            buyQty: position.buyQty,               // Buy Qty
            sellQty: position.sellQty,             // Sell Qty
            realisedPnL: position.realizedProfit,                  // Realised P&L
            unrealisedPnL: position.unrealizedProfit,              // Unrealised P&L
            product: position.productType                        // Product
          }
        })
        console.log("cp",convertedPositions);
        return convertedPositions
      } catch (error) {
        
      }
  }


  public async getFunds(access_token: string): Promise<any> {
    const config =  {
      method: 'GET',
      url: 'https://api.dhan.co/v2/fundlimit',
      headers: {'access-token': access_token, Accept: 'application/json'}
    };
    const resp = await axios(config)
    console.log(resp.data);
    return resp.data;
  }

  public async getTrades(access_token: string): Promise<any> {
    let config = {
      method: 'GET',
      url: 'https://api.dhan.co/v2/trades',
      headers: {'access-token': access_token, Accept: 'application/json'}
    };
    
    const response = await axios(config)
    return response.data.data
  }

  }






  
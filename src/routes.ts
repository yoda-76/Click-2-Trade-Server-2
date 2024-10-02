import { Express, Request, Response } from "express";
import {  login, logout, register,  } from "./controller/auth.controller";
import { authenticate } from "./middleware/authenticate";
import { addAccount, getFunds } from "./controller/accounts.controller";
import { upstoxAuth, zerodhaAuth } from "./controller/broker-auth";
import { AccountManager } from "./core/accountsManager";
import { UpstoxBroker } from "./brokers/upstox.service";
import { cancelOrder, getOrders, placeOrder } from "./controller/order.controller";
import { getPositions } from "./controller/positions.controller";



function routes(app: Express) {
  //health check
  app.get("/api/test", async (req: Request, res: Response) => { 
    res.send("Server is healthy");
  });
  


  // auth
  app.post("/api/register", register);  
  app.post("/api/login", login);
  app.post("/api/logout", authenticate, logout)

  //broker auth
  app.get("/api/upstox/auth", upstoxAuth)
  app.get("/api/kite/auth", zerodhaAuth)


  app.post("/api/fill-stores", authenticate, )

  app.post("/api/get-positions", authenticate, getPositions)
  app.post("/api/get-tracked-positions", authenticate, getPositions)
  


  // accounts
  app.post("/api/add-account", authenticate, addAccount);

  //tradeing console
  app.post("/api/get-funds", authenticate, getFunds);
  app.post("/api/place-order", authenticate, placeOrder);
  app.post("/api/cancel-order", authenticate, cancelOrder);
  app.post("/api/get-orders", authenticate, getOrders)
  // "BANKNIFTY": {
  //   "2024-11-27 : 43000.0": {
  //     "CE": {
  //       "instrument_key": "NSE_FO|38597",
  //       "exchange_token": "38597",
  //       "tradingsymbol": "BANKNIFTY24NOV43000CE",
  //       "name": "",
  //       "last_price": "0.0",
  //       "expiry": "2024-11-27",
  //       "strike": "43000.0",
  //       "tick_size": "0.05",
  //       "lot_size": "15",
  //       "instrument_type": "OPTIDX",
  //       "option_type": "CE",
  //       "exchange": "NSE_FO"
  //     },


  



  //test
  app.post("/api/ex",(req,res)=>{
    function extractOptionDetails(tradingSymbol) {
      // Regular expression to capture the base instrument, year, month/day, strike, and option type (CE/PE)
      const regex = /([A-Z]+)(\d{2})([A-Z]{1}\d{1,2}[A-Z]{0,2}|\w{3})(\d+)(CE|PE)/;
  
      const match = tradingSymbol.match(regex);
      
      if (!match) {
          throw new Error('Invalid trading symbol format');
      }
  
      const baseInstrument = match[1];
      const year = `20${match[2]}`;  // Extract last two digits of the year, assuming 20xx.
      const monthOrDay = match[3];    // Could be month (OCT) or day format (O01).
      const strike = match[4];
      const optionType = match[5];
      console.log(baseInstrument, year, monthOrDay, strike, optionType);
      
      let expiry; 
      const lastExpMonths = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  
      // Handling expiry for month names (e.g., OCT, NOV, DEC)
      if(lastExpMonths.includes(monthOrDay)){
        const monthMapping = {
            'JAN': '01',
            'FEB': '02',
            'MAR': '03',
            'APR': '04',
            'MAY': '05',
            'JUN': '06',
            'JUL': '07',
            'AUG': '08',
            'SEP': '09',
            'OCT': '10',
            'NOV': '11',
            'DEC': '12'
        };
        // const date = "30";  //how to get last expiry
        // expiry = `${year}-${monthMapping[monthOrDay]}-${date}` 
        expiry = null
      }else if(monthOrDay[0]==='O' || monthOrDay[0]==='N' || monthOrDay[0]==='D'){
        const monthMapping = {
          'O': '10',
          'N': '11',
          'D': '12'
      };
        expiry = `${year}-${monthMapping[monthOrDay[0]]}-${monthOrDay[1]}${monthOrDay[2]}`;
      }else{
        expiry = `${year}-0${monthOrDay[0]}-${monthOrDay[1]}${monthOrDay[2]}`
      }
  
      return {
          baseInstrument,
          expiry,
          strike,
          optionType
      };
  }
  
  // Example usage
  const data=extractOptionDetails(req.body.symbol)  
  res.json(data)
  })


  app.post("/api/get-at-by-id", (req: Request, res: Response) => {
    const { u_id } = req.body;
    const accountManager = AccountManager.getInstance();
    const accounts = accountManager.getAccessToken(u_id);
    res.json(accounts);
  })

  app.post("/api/get-instrumentData", (req: Request, res: Response) => {
    const upstoxBroker = UpstoxBroker.getInstance();
    const instrumentData = upstoxBroker.getInstrumentDataAsObject();
    res.json(instrumentData);
  })
  app.post("/api/get-instrumentDataSearchMap", (req: Request, res: Response) => {
    const upstoxBroker = UpstoxBroker.getInstance();
    const instrumentDataSearchMap = upstoxBroker.getInstrumentDataSearchMapAsObject();
    res.json(instrumentDataSearchMap);
  })

  app.post("/api/test-add-acc", async (req: Request, res: Response) => {
    const accountManager = AccountManager.getInstance();
    
    // Add account
    accountManager.addAuthenticatedAccount("test", "test-id", "test-token", "UPSTOCKS");
    
    // Retrieve authenticated accounts
    const accounts = accountManager.getAllAuthenticatedAccountsAsObject();
    
    // Log the accounts map
    console.log("Authenticated Accounts:", accounts);
    
    res.json({ data: accounts, msg: "ok" });
});

}

export default routes;

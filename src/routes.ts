import { Express, Request, Response } from "express";
import {  login, logout, register,  } from "./controller/auth.controller";
import { authenticate } from "./middleware/authenticate";
import { addAccount, deleteChildAccount, deleteMasterAccount, getAccounts, getChildAccountByMasterUid, getFunds, toggleChildAccount, updateChildMultiplier } from "./controller/accounts.controller";
import { dhanAuth, upstoxAuth, zerodhaAuth } from "./controller/broker-auth";
import { AccountManager } from "./core/accountsManager";
import { UpstoxBroker } from "./brokers/upstox.service";
import { DhanBroker } from "./brokers/dhan/dhan.service";

import { cancelAllOrders, cancelOrder, getOrders, placeOrder, squareoffAllPositions, squareoffSinglePositions } from "./controller/order.controller";
import { getPositions } from "./controller/positions.controller";
import { getPrefrences, getUserDetails, updatePrefrences } from "./controller/user.controller";
import { getOptionChainDashboard, optionChainAuthController, optionChainController, stopOptionChainProcessing } from "./controller/option-chain.controller";



function routes(app: Express) {
  //health check
  app.get("/api/test", async (req: Request, res: Response) => { 
    res.send("Server is healthy");
  });
  


  // auth
  app.post("/api/register", register);  
  app.post("/api/login", login);
  app.post("/api/logout", authenticate, logout)
  //change password


  //broker auth
  app.get("/api/upstox/auth", upstoxAuth)
  app.post("/api/dhan/auth", dhanAuth)
  app.get("/api/kite/auth", zerodhaAuth)
  app.get("/api/optionchain/auth", optionChainAuthController)
  
  app.post("/api/fill-stores", authenticate, ) //TODO
  
  
  // accounts
  app.post("/api/get-funds", authenticate, getFunds)
  app.post("/api/add-account", authenticate, addAccount);
  
  //tradeing console
  app.post("/api/get-funds", authenticate, getFunds);
  app.post("/api/place-order", authenticate, placeOrder);
  app.post("/api/cancel-order", authenticate, cancelOrder);
  app.post("/api/cancel-all-order", authenticate,cancelAllOrders); //TODO
  app.post("/api/get-orders", authenticate, getOrders)
  app.post("/api/get-positions", authenticate, getPositions)
  
  
  app.post("api/get-user-prefrences", authenticate, getPrefrences)
  app.post("api/update-user-prefrences", authenticate, updatePrefrences)

  // user details
  app.post("/api/get-user-details", authenticate, getUserDetails) //not protected but doesnot need u_id

  // master acount
  app.post("/api/get-account-details",authenticate, getAccounts)
  app.post("/api/delete-master-account", authenticate, deleteMasterAccount);

  // child accounts
  app.post("/api/get-child-account-details",authenticate,getChildAccountByMasterUid)
  app.post("/api/update-multiplier", authenticate,updateChildMultiplier);
  app.post("/api/toggle-active" ,authenticate,toggleChildAccount);
  app.post("/api/delete-child-account", authenticate, deleteChildAccount)

  //square off
  app.post("/api/square-off-all",authenticate, squareoffAllPositions)
  app.post("/api/square-off-single",authenticate, squareoffSinglePositions)

  
  //predefined sl and target
  app.post("/api/update-prefrences", authenticate, updatePrefrences)
  // app.post("/api/update-prefrences-target", authenticate, updatePrefrenceTarget)
  app.post("/api/get-prefrences", authenticate, getPrefrences)

        
        
        
        
        
        //test
        app.post("/api/get-instrumentData", (req: Request, res: Response) => {
          const upstoxBroker = UpstoxBroker.getInstance();
          const instrumentData = upstoxBroker.getInstrumentDataAsObject();
          res.json(instrumentData);
        })

        app.post("/api/get-dhan-instrumentData", (req: Request, res: Response) => {
          const dhanBroker = DhanBroker.getInstance();
          const instrumentData = dhanBroker.getInstrumentDataAsObject();
          res.json(instrumentData);
        })
        
        app.post("/api/get-dhan-instrumentDataSearchMap", (req: Request, res: Response) => {
          const dhanBroker = DhanBroker.getInstance();
          const instrumentDataSearchMap = dhanBroker.getInstrumentDataSearchMapAsObject();
          res.json(instrumentDataSearchMap);
        })


        app.get("/api/get-tokens-to-be-subscribed", (req: Request, res: Response) => {
          const upstoxBroker = UpstoxBroker.getInstance();
          const tokens = upstoxBroker.getTokensToBeSubscribed();
          res.json({tokens});
        })
        
        app.post("/api/get-instrumentDataSearchMap", (req: Request, res: Response) => {
          const upstoxBroker = UpstoxBroker.getInstance();
          const instrumentDataSearchMap = upstoxBroker.getInstrumentDataSearchMapAsObject();
          res.json(instrumentDataSearchMap);
        })

        app.post("/api/get-option-chain", optionChainController)
        app.post("/api/get-option-chain-dashboard", getOptionChainDashboard)
        app.post("/api/stop-option-chain-interval", stopOptionChainProcessing)
        
    
  app.post("/api/test-add-acc", async (req: Request, res: Response) => {
    const accountManager = AccountManager.getInstance();
    
    // Retrieve authenticated accounts
    const accounts = accountManager.getAllAuthenticatedAccountsAsObject();
    
    // Log the accounts map
    console.log("Authenticated Accounts:", accounts);
    
    res.json({ data: accounts, msg: "ok" });
});

}

export default routes;

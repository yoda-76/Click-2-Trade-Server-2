import { AccountManager } from "./accountsManager";
import { UpstoxBroker } from "../brokers/upstox.service";
import { dbClient } from "../utils/dbClient";
import { OrderDetails } from "../Interface";
import { DhanBroker } from "../brokers/dhan/dhan.service";
import { AngelOne } from "../brokers/angel/angel.service";
// Add other broker imports as needed


// {index: string, qty: number, price: number, order_type: string, product: string, key: number, transaction_type: string, trigger_price: number}

interface CustomOrderBook {
  [accountId: string]: {
    orders: {
      [orderId: string]: {
        orderDetails: any;
        childOrders: {accountId: string, orderId: string}[]; // Child order IDs
      };
    };
  };
}

interface CustomPosition {
  [accountId: string]: {
    trackedPositions: {
      [symbol: string]: any
    };
    untrackedPositions: {
      [symbol: string]: any
    };
  };
}

export class OrderManager {
  private static instance: OrderManager;
  private customOrderBook: CustomOrderBook = {};
  private customPosition: CustomPosition = {};

  // Private constructor for singleton pattern
  private constructor() {}

  // Singleton pattern to get the instance of OrderManager
  public static getInstance(): OrderManager {
    if (!OrderManager.instance) {
      OrderManager.instance = new OrderManager();
    }
    return OrderManager.instance;
  }

  // Place order in master and child accounts
  public async placeOrder(
    accountId: string,
    orderDetails: OrderDetails
  ): Promise<void> {
    const accountManager = AccountManager.getInstance();
    const broker = accountManager.getBroker(accountId);

    if (!broker) throw new Error("Broker not found for this account");

    const orderId = await this.placeOrderInBroker(accountId, orderDetails, broker);
    const orderDetailsFromBroker  = await this.getOrderDetailsByOrderId(accountId, orderId, broker); 
    this.addOrderToOrderBook(accountId, orderId, orderDetailsFromBroker);

    // Copy order to child accounts
    const orignalQty = orderDetails.qty;
    const id = accountManager.getAuthenticatedAccountId(accountId);
    const childAccounts = await dbClient.getChildAccountsByMasterId(id);
    for (const childAccount of childAccounts) {
      if (!childAccount.active) continue;
      const childAccountId = `CHILD:${childAccount.u_id}`;
      const childAccountDetails = accountManager.getAuthenticatedAccountId(childAccountId);
      console.log(childAccountDetails);
      if(!childAccountDetails) continue;
      orderDetails.qty = orignalQty * childAccount.multiplier;
      console.log("----ORDERS IN CHILD ACCOUNT WILL BE----");
      console.log("orderDetails", orderDetails);
      // console.log(childAccountDetails);
      const childOrderId = await this.placeOrderInBroker(`CHILD:${childAccount.u_id}`, orderDetails, childAccount.broker);
      this.addChildOrderToOrderBook(accountId, `CHILD:${childAccount.u_id}`, orderId, childOrderId);
    }
    return 
  }

  private async getPositionByOrderDetails(accountId: string, orderDetails: OrderDetails) {
    const upstoxBroker = UpstoxBroker.getInstance();
    const position = await upstoxBroker.getPositionByOrderDetails(accountId, orderDetails);
    // console.log("positions from broker", position);
    return position;
  }

  private updatePositions (accountId: string, position: any) {
    //search thru existing position of the account and update it
    const symbol = position.symbolName;
    this.customPosition[accountId].trackedPositions[symbol] = position;
    return
  }

  private async getOrderDetailsByOrderId(accountId: string, orderId: string, broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO") {
    let orderDetails;
    switch (broker) {
      case "UPSTOCKS":
        const upstoxBroker = UpstoxBroker.getInstance();
        orderDetails = await upstoxBroker.getOrderDetailsByOrderId(accountId, orderId);
        console.log("order in upstox", orderDetails);
        return orderDetails;
      // Add cases for other brokers
      case "DHAN":
        const dhanBroker = DhanBroker.getInstance();
        orderDetails = await dhanBroker.getOrderDetailsByOrderId(accountId, orderId);
        console.log("order in dhan", orderDetails);
        return orderDetails;
      case "ANGEL":
        const angelBroker = AngelOne.getInstance();
        orderDetails = await angelBroker.getOrderDetailsByOrderId(accountId, orderId);
        console.log("order in angel", orderDetails);
        return orderDetails;
        
      default:
        throw new Error("Broker not supported");
    }
  }

  // Helper method to place order with broker
  private async placeOrderInBroker(accountId: string, orderDetails: OrderDetails, broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO"): Promise<string> {
    let order_id:string = "";
    try {
      switch (broker) {
        case "UPSTOCKS":
          const upstoxBroker = UpstoxBroker.getInstance();
          order_id = await upstoxBroker.placeOrder(accountId, orderDetails);
          console.log("order in upstox");
          return order_id;
        case "DHAN":
          const dhanBroker = DhanBroker.getInstance();
          order_id= await dhanBroker.placeOrder(accountId, orderDetails);
          console.log("order in dhan");
          return order_id;
        case "ANGEL":
          const angelBroker = AngelOne.getInstance();
          order_id = await angelBroker.placeOrder(accountId, orderDetails);
          console.log("order in angel");
          return order_id;
        // Add cases for other brokers
        default:
          throw new Error("Broker not supported");
      }
      
    } catch (error) {
      throw new Error(error);
    }
  }

  // Add order to custom order book
  private addOrderToOrderBook(accountId: string, orderId: string, orderDetails: any): void {
    //fetch this order from broker
    //convert it to base
    //add it to custom order book
    if (!this.customOrderBook[accountId]) {
      this.customOrderBook[accountId] = { orders: {} };
    }
    this.customOrderBook[accountId].orders[orderId] = {
      orderDetails,
      childOrders: []
    };

    //save to db
    this.persistOrderbook(accountId);
  }

  // Add child order to existing master order in the order book
  private addChildOrderToOrderBook(masterAccountId: string, childAccountId: string, masterOrderId: string, childOrderId: string): void {
    const masterOrder = this.customOrderBook[masterAccountId]?.orders[masterOrderId];
    if (masterOrder) {
      masterOrder.childOrders.push({accountId:childAccountId , orderId: childOrderId});
    }
  }

  private updateOrderDetailsInOrderBook(accountId: string, orderId: string, orderDetails: any) {
    const order = this.customOrderBook[accountId]?.orders[orderId];
    if (order) {
      order.orderDetails = orderDetails;
    }
  }

  // Cancel an order in master and child accounts
  public async cancelOrder(accountId: string, orderId: string): Promise<void> {
    const accountManager = AccountManager.getInstance();
    const broker = accountManager.getBroker(accountId);

    if (!broker) throw new Error("Broker not found for this account");

    await this.cancelOrderInBroker(accountId, orderId, broker);

    // Cancel child orders
    const childOrders = this.customOrderBook[accountId]?.orders[orderId]?.childOrders;
    if (childOrders) {
      for (const childOrder of childOrders) {
        await this.cancelOrderInBroker(childOrder.accountId, childOrder.orderId, broker);
      }
    }
    const newOrderDetails = await this.getOrderDetailsByOrderId(accountId, orderId, broker);
    this.updateOrderDetailsInOrderBook(accountId, orderId, newOrderDetails);
    return 
    // this.removeOrderFromOrderBook(accountId, orderId);//update orderbook insted of removing the cancelled orders
  }

  // Helper method to cancel order with broker
  private async cancelOrderInBroker(accountId: string, orderId: string, broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO"): Promise<void> {
    switch (broker) {
      case "UPSTOCKS":
        const upstoxBroker = UpstoxBroker.getInstance();
        return await upstoxBroker.cancelOrder(accountId, orderId);
      case "DHAN":
        const dhanBroker = DhanBroker.getInstance();
        return await dhanBroker.cancelOrder(accountId, orderId);
      // Add cases for other brokers
      default:
        throw new Error("Broker not supported");
    }
  }

  // Remove an order from custom order book
  // private removeOrderFromOrderBook(accountId: string, orderId: string): void {
  //   delete this.customOrderBook[accountId]?.orders[orderId];
  // }

  // Cancel all orders for a master and child accounts
  public async cancelAllOrders(accountId: string): Promise<void> {
    const accountOrders = this.customOrderBook[accountId]?.orders;
    console.log(accountOrders);
    if (accountOrders) {
      for (const orderId of Object.keys(accountOrders)) {
        // inclued a check where we see if the order is not already cancelled
        await this.cancelOrder(accountId, orderId);
      }
    }
  }

  public async getOrderBook(accountId: string): Promise<any> {
    const accountOrders = this.customOrderBook[accountId]?.orders;
    if (accountOrders) {
      return accountOrders;
    }
    return {};
  }

  private async persistOrderbook(accountId: string): Promise<void> {
    const accountOrders = this.customOrderBook[accountId]?.orders;
    if (accountOrders) {
      this.customOrderBook[accountId].orders = accountOrders;
    }
    Object.keys(accountOrders).forEach(async (key) => {
      const orderDetails = accountOrders[key].orderDetails;
      const childOrders = accountOrders[key].childOrders;
      await dbClient.persistOrderbook(accountId, key, orderDetails, childOrders);
    })
    //save to db

  }

  // Exit a single position based on account ID and instrument identifier
  public async exitSinglePosition(accountId: string, position: any): Promise<void> {
    const accountManager = AccountManager.getInstance();
    const broker = accountManager.getBroker(accountId);
    if(position.netQty === 0 || position.netQty === "0" ) return;
    //convert position into orderDetail
    const orderDetails: OrderDetails = {
      baseInstrument: position.baseInstrument,
      instrumentType: position.instrumentType==="PE" || position.instrumentType==="CE" || position.instrumentType==="OPTIDX"? "OPT" : "EQ",
      expiry: position.expiry,
      strike: position.strike,
      optionType: position.optionType,
      exchange: position.exchange,
      qty: position.netQty, 
      price: 0, 
      triggerPrice: 0, 
      orderType: "MARKET", 
      side: position.netQty<0?"BUY":"SELL",
      productType: position.product
    }
    const order = this.placeOrder(accountId, orderDetails);
  }

  // Exit all positions for master and child accounts
  public async exitAllPositions(accountId: string): Promise<void> {
    const accountManager = AccountManager.getInstance();
    const broker = accountManager.getBroker(accountId);
    const positions = await this.getPositions(accountId);
    for(const position of positions){
      if(position.netQty==0 || position.netQty == "0") continue;
      const orderDetails: OrderDetails = {
        baseInstrument: position.baseInstrument,
        instrumentType: (position.instrumentType==="CE"||position.instrumentType==="PE" || position.instrumentType==="OPTIDX")?"OPT":position.instrumentType,
        expiry: position.expiry,
        strike: position.strike,
        optionType: position.optionType,
        exchange: position.exchange,
        qty: position.netQty, 
        price: 0, 
        triggerPrice: 0, 
        orderType: "MARKET", 
        side: position.netQty<0?"BUY":"SELL",
        productType: position.product
      }
      await this.placeOrder(accountId, orderDetails);
    }
    console.log(`Exiting all positions for account ${accountId}`);
  }

  // Fetch trade book (without maintaining child data)
  public async getTradeBook(accountId: string): Promise<any> {
    const accountManager = AccountManager.getInstance();
    const account = accountManager.getAuthenticatedAccountsAsObject(accountId);
    const broker = accountManager.getBroker(accountId);
    switch (broker) {
      case "UPSTOCKS":
        const upstoxBroker = UpstoxBroker.getInstance();
        return await upstoxBroker.getTrades(account.accessToken);
      // Add cases for other brokers
      case "DHAN":
        const dhanBroker = DhanBroker.getInstance();
        return await dhanBroker.getTrades(account.accessToken);
      default:
        throw new Error("Broker not supported");
    }
  }

  // Fetch positions (without maintaining child data)
  // public async getPositions(accountId: string): Promise<any> {
  //   // const positions = this.customPosition[accountId].trackedPositions
  //   const positions:any = await UpstoxBroker.getInstance().getPositions(accountId);
  //   // console.log(positions);
  //   if (positions) {
  //     return positions
  //   }
  //   return {}
  // }
  public async getPositions(accountId: string): Promise<any> {
    const accountManager = AccountManager.getInstance();
    const account = accountManager.getAuthenticatedAccountsAsObject(accountId);
    // let position:any={}
    console.log("broker:",account.broker);

    if(account.broker === "UPSTOCKS"){
      const upstoxBroker = UpstoxBroker.getInstance();
      const position = await upstoxBroker.getPositions(account.accessToken);
      return position;
        
    }else if(account.broker === "DHAN"){
      const dhanBroker = DhanBroker.getInstance();
      const position = await dhanBroker.getPositions(account.accessToken);
      return position
    }else{
      throw new Error('Broker not supported');
    }

    // switch (account.broker) {
    //   case "UPSTOCKS":
       
    //   // Add cases for other brokers
    //   case "DHAN":
    //     const dhanBroker = DhanBroker.getInstance();
    //     return await dhanBroker.getPositions(account.accessToken);
    //   default:
    //     throw new Error("Broker not supported");
    // }
  }
}

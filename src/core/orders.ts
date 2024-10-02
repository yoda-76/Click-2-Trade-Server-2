import { AccountManager } from "./accountsManager";
import { UpstoxBroker } from "../brokers/upstox.service";
import { dbClient } from "../utils/dbClient";
import { OrderDetails } from "../Interface";
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

    // const position = await this.getPositionByOrderDetails(accountId, orderDetails);
    // this.updatePositions(accountId, position);
    //get base-formated positions with orderDetails from client and instrument token from kiet socket
    //save them 

    // Copy order to child accounts
    const id = accountManager.getAuthenticatedAccountId(accountId);
    const childAccounts = await dbClient.getChildAccountsByMasterId(id);
    for (const childAccount of childAccounts) {
      const childAccountId = `CHILD:${childAccount.u_id}`;
      const childAccountDetails = accountManager.getAuthenticatedAccountId(childAccountId);
      if(!childAccountDetails) continue;
      console.log("object111");
      const childOrderId = await this.placeOrderInBroker(`CHILD:${childAccount.u_id}`, orderDetails, broker);
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

    switch (broker) {
      case "UPSTOCKS":
        const upstoxBroker = UpstoxBroker.getInstance();
        const orderDetails = await upstoxBroker.getOrderDetailsByOrderId(accountId, orderId);
        console.log("order in upstox", orderDetails);
        return orderDetails;
      // Add cases for other brokers
      default:
        throw new Error("Broker not supported");
    }
  }

  // Helper method to place order with broker
  private async placeOrderInBroker(accountId: string, orderDetails: OrderDetails, broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO"): Promise<string> {
    switch (broker) {
      case "UPSTOCKS":
        const upstoxBroker = UpstoxBroker.getInstance();
        const order_id:string = await upstoxBroker.placeOrder(accountId, orderDetails);
        console.log("order in upstox");
        return order_id;
      // Add cases for other brokers
      default:
        throw new Error("Broker not supported");
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

  // Exit a single position based on account ID and instrument identifier
  public async exitSinglePosition(accountId: string, instrumentId: string, symbol: string): Promise<void> {
    // For now instrumentId will recive ltpToken
    const accountManager = AccountManager.getInstance();
    const broker = accountManager.getBroker(accountId);

    //fetch the position
    const positions = await this.customPosition[accountId].trackedPositions[symbol];
    const exitOrderDetails:OrderDetails = { 
      baseInstrument: positions.baseInstrument, 
      instrumentType: positions.instrumentType, 
      expiry: positions.expiry, 
      strike: positions.strike, 
      optionType: positions.optionType, 
      exchange: positions.exchange, 
      qty: positions.qty, 
      price: null, 
      triggerPrice: null, 
      orderType: "MARKET", 
      side: positions.qty > 0 ? "SELL" : "BUY", 
      productType: positions.product };
    const order = this.placeOrder(accountId, exitOrderDetails);
    
  }

  // Exit all positions for master and child accounts
  public async exitAllPositions(accountId: string): Promise<void> {
    // Implement logic to exit all positions using broker API
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
      default:
        throw new Error("Broker not supported");
    }
  }

  // Fetch positions (without maintaining child data)
  public async getPositions(accountId: string): Promise<any> {
    // const positions = this.customPosition[accountId].trackedPositions
    const positions:any = await UpstoxBroker.getInstance().getPositions(accountId);
    console.log(positions);
    if (positions) {
      return positions
    }
    return {}
  }
}

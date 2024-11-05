import { OrderDetails } from "../Interface";
export declare class OrderManager {
    private static instance;
    private customOrderBook;
    private customPosition;
    private constructor();
    static getInstance(): OrderManager;
    placeOrder(accountId: string, orderDetails: OrderDetails): Promise<void>;
    private getPositionByOrderDetails;
    private updatePositions;
    private getOrderDetailsByOrderId;
    private placeOrderInBroker;
    private addOrderToOrderBook;
    private addChildOrderToOrderBook;
    private updateOrderDetailsInOrderBook;
    cancelOrder(accountId: string, orderId: string): Promise<void>;
    private cancelOrderInBroker;
    cancelAllOrders(accountId: string): Promise<void>;
    getOrderBook(accountId: string): Promise<any>;
    private persistOrderbook;
    exitSinglePosition(accountId: string, position: any): Promise<void>;
    exitAllPositions(accountId: string): Promise<void>;
    getTradeBook(accountId: string): Promise<any>;
    getPositions(accountId: string): Promise<any>;
}

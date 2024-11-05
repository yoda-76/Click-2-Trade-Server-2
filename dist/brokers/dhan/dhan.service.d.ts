import { OrderDetails } from 'Interface';
export declare class DhanBroker {
    private static instance;
    private instrumentData;
    private instrumentDataSearchMap;
    private constructor();
    static getInstance(): DhanBroker;
    handleWebhook(id: string, access_token: string, dhanClientId: string): Promise<string>;
    getInstrumentDataAsObject(): Record<string, any>;
    getInstrumentDataSearchMapAsObject(): Map<string, any>;
    private loadInstrumentData;
    private structureInstrumentData;
    placeOrder(accountId: string, orderDetails: OrderDetails): Promise<any>;
    cancelOrder(accountId: string, orderId: string): Promise<any>;
    getOrderDetailsByOrderId(accountId: string, orderId: string): Promise<{
        symbolName: any;
        type: any;
        side: any;
        qty: any;
        remQty: any;
        orderPrice: any;
        tradedPrice: any;
        triggerPrice: any;
        status: any;
        timeStamp: any;
        orderId: any;
        message: any;
    }>;
    getPositions(access_token: string): Promise<any>;
    getFunds(access_token: string): Promise<any>;
    getTrades(access_token: string): Promise<any>;
}

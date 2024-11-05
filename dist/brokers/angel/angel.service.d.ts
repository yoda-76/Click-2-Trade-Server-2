import { OrderDetails } from 'Interface';
export declare class AngelOne {
    private static instance;
    private instrumentData;
    private instrumentDataSearchMap;
    private tokenToBeSubscribed;
    private constructor();
    static getInstance(): AngelOne;
    handleWebhook(id: string, clientCode: string, password: string, totp: string): Promise<string>;
    getInstrumentDataAsObject(): Record<string, any>;
    getInstrumentDataSearchMapAsObject(): Map<string, any>;
    private loadInstrumentData;
    private structureInstrumentData;
    placeOrder(accountId: string, orderDetails: OrderDetails): Promise<any>;
    getOrderDetailsByOrderId(accountId: string, orderId: string): Promise<{}>;
    getFunds(access_token: string, api_key: string): Promise<any>;
}

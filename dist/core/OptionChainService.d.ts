interface OptionData {
    time: string;
    expiry: string;
    pcr: number;
    strike_price: number;
    underlying_key: string;
    underlying_spot_price: number;
    call_options: {
        instrument_key: string;
        market_data: MarketData;
        option_greeks: OptionGreeks;
    };
    put_options: {
        instrument_key: string;
        market_data: MarketData;
        option_greeks: OptionGreeks;
    };
}
interface MarketData {
    ltp: number;
    volume: number;
    oi: number;
    close_price: number;
    bid_price: number;
    bid_qty: number;
    ask_price: number;
    ask_qty: number;
    prev_oi: number;
}
interface OptionGreeks {
    vega: number;
    theta: number;
    gamma: number;
    delta: number;
    iv: number;
}
declare class OptionChainHandler {
    private static instance;
    private optionChainStore;
    private dashboardStore;
    private staticOptions;
    private accessToken;
    private intervalId;
    private constructor();
    static getInstance(): OptionChainHandler;
    private fetchOptionChain;
    updateOptionChain(): Promise<void>;
    private setstaticOptions;
    private processAndStoreVega;
    storeAccessToken(authcode: string): Promise<string>;
    private startFetchingOptionChain;
    getOptionChain(): Record<string, Record<string, Record<string, OptionData[]>>>;
    getDashboard(): Record<string, Record<string, Record<string, {
        changeInPutVega: number;
        changeInCallVega: number;
    }>>>;
    stopFetchingOptionChain(): void;
}
export default OptionChainHandler;

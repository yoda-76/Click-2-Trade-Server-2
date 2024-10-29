import axios from 'axios';

const apiKey = process.env.KEY_OPTION_CHAIN;
const apiSecret = process.env.SECRET_OPTION_CHAIN;
const expiries = {
    'NSE_INDEX|Nifty Bank': '2024-11-06',
    'NSE_INDEX|Nifty 50': '2024-11-07',
};
const indecies = ['NSE_INDEX|Nifty Bank', 'NSE_INDEX|Nifty 50'];
const deltaRange = {low: 0.05, high: 0.6};
const fetchInterval = 60000;
const baseTime = '09:20';
const redirectUrl = process.env.OPTION_CHAIN_REDIRECT_URL;

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

class OptionChainHandler {
    private static instance: OptionChainHandler;
    private optionChainStore: Record<string, Record<string, Record<string, OptionData[]>>> = {};
    private dashboardStore: Record<string, Record<string, Record<string, { changeInPutVega: number; changeInCallVega: number }>>> = {};
    private staticOptions: Record<string, OptionData[]> = {}; // {index: OptionData[]}
    private accessToken: string = "";
    private intervalId: NodeJS.Timeout | null = null;

    private constructor() {} // Private constructor to prevent direct instantiation

    public static getInstance(): OptionChainHandler {
        if (!OptionChainHandler.instance) {
            OptionChainHandler.instance = new OptionChainHandler();
        }
        return OptionChainHandler.instance;
    }

    private async fetchOptionChain(base: string, expiry: string): Promise<OptionData[]> {
        const config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: `https://api.upstox.com/v2/option/chain?instrument_key=${encodeURIComponent(base)}&expiry_date=${expiry}`,
            headers: { 
                'Accept': 'application/json',
                Authorization: `Bearer ${this.accessToken}`,
            }
        };
        
        const response = await axios(config);
        const currentTime = new Date().toLocaleTimeString('en-IN', {
            timeZone: 'Asia/Kolkata',  // Explicitly setting to India's timezone
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false, // Use true for 12-hour format
          });
        return response.data.data.map((item: any) => ({
            ...item,
            time: currentTime, // Store only the time part
        }));
    }

    public async updateOptionChain(): Promise<void> {
        const indexes = indecies;
        const expiry: Record<string, string> = expiries;

        for (const index of indexes) {
            const chainData = await this.fetchOptionChain(index, expiry[index]);
            const currentDate = new Date().toISOString().split("T")[0]; // Date part only
            const currentTime = new Date().toLocaleTimeString('en-IN', {
                timeZone: 'Asia/Kolkata',  // Explicitly setting to India's timezone
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false, // Use true for 12-hour format
              });
            // Initialize index and date if not already present
            if (!this.optionChainStore[index]) {
                this.optionChainStore[index] = {};
            }
            if (!this.optionChainStore[index][currentDate]) {
                this.optionChainStore[index][currentDate] = {};
            }
            if (!this.optionChainStore[index][currentDate][currentTime]) {
                this.optionChainStore[index][currentDate][currentTime] = [];
            }
            // Append fetched data with time to the correct date array
            this.optionChainStore[index][currentDate][currentTime].push(...chainData);

            // Set static vega on the first fetch
            const currentHourMinute = currentTime.slice(0, 5); // Get 'HH:mm'
            if (!this.staticOptions[index] && currentHourMinute === baseTime) { // Check current time against base time up to minutes
                this.setstaticOptions(index, chainData);
            }

            // Process the option chain and store changes
            this.processAndStoreVega(index, chainData, currentDate, currentTime);
        }
    }

    private setstaticOptions(index: string, chainData: OptionData[]): void {
        this.staticOptions[index] = chainData; // Store the whole option chain for that index
        console.log(`Static Options set for index ${index}.`);
    }

    private processAndStoreVega(index: string, chainData: OptionData[], currentDate: string, currentTime: string): void {
        let liveCallVega = 0;
        let livePutVega = 0;
        let filteredOptions = chainData.filter(option => {
            const callDelta = option.call_options.option_greeks.delta;
            const putDelta = option.put_options.option_greeks.delta;
            // console.log(option)
            return (callDelta >= deltaRange.low && callDelta <= deltaRange.high) || (putDelta >= deltaRange.low && putDelta <= deltaRange.high);
        });

        // console.log(filteredOptions[0], filteredOptions[1])

        // Calculate live vega sums
        for (const option of filteredOptions) {
            liveCallVega += option.call_options.option_greeks.vega;
            livePutVega += option.put_options.option_greeks.vega;
        }

        const staticFilteredOptions = this.staticOptions[index]?.filter(option => {
            const callDelta = option.call_options.option_greeks.delta;
            const putDelta = option.put_options.option_greeks.delta;
            return (callDelta >= deltaRange.low && callDelta <= deltaRange.high) || (putDelta >= deltaRange.low && putDelta <= deltaRange.high);
        }) || [];

        // Calculate staticPutVega and staticCallVega
        const staticPutVega = staticFilteredOptions.reduce((sum, option) => sum + (option.put_options.option_greeks.vega || 0), 0);
        const staticCallVega = staticFilteredOptions.reduce((sum, option) => sum + (option.call_options.option_greeks.vega || 0), 0);



        // Calculate change in vega
        const changeInCallVega = liveCallVega - staticCallVega; // Use static put vega for call change
        const changeInPutVega = livePutVega - staticPutVega;   // Use static call vega for put change

        console.log(liveCallVega, staticCallVega, livePutVega, staticPutVega, changeInCallVega, changeInPutVega);

        // Initialize dashboard store
        if (!this.dashboardStore[index]) {
            this.dashboardStore[index] = {};
        }
        if (!this.dashboardStore[index][expiries[index]]) {
            this.dashboardStore[index][expiries[index]] = {};
        }
        if (!this.dashboardStore[index][expiries[index]][currentTime]) {
            this.dashboardStore[index][expiries[index]][currentTime] = { changeInPutVega: 0, changeInCallVega: 0 };
        }

        // Store the results
        this.dashboardStore[index][expiries[index]][currentTime].changeInPutVega = changeInPutVega;
        this.dashboardStore[index][expiries[index]][currentTime].changeInCallVega = changeInCallVega;
    }

    public async storeAccessToken(authcode: string): Promise<string> {
        try {
            const response = await axios.post(
                "https://api.upstox.com/v2/login/authorization/token",
                new URLSearchParams({
                    code: authcode,
                    client_id: apiKey,
                    client_secret: apiSecret,
                    redirect_uri: redirectUrl,
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

            this.accessToken = response.data.access_token;
            console.log(`Access token stored successfully.`);
            
            // Start fetching option chain data every minute
            this.startFetchingOptionChain();

            return `Access token stored successfully.`;
        } catch (error) {
            console.error("Error in storeAccessToken:", error);
            throw new Error("Error storing access token.");
        }
    }

    private startFetchingOptionChain(): void {
        if (this.intervalId) return; // Prevent multiple intervals from being set
        console.log("Starting to fetch option chain data every minute");
        this.intervalId = setInterval(async () => {
            try {
                await this.updateOptionChain();
                const currentTime = new Date().toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',  // Explicitly setting to India's timezone
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false, // Use true for 12-hour format
                  });
                console.log("Option chain updated successfully at ", currentTime);
            } catch (error) {
                console.error("Error updating option chain:", error);
            }
        }, fetchInterval); // 60,000 milliseconds = 1 minute
    }

    public getOptionChain(): Record<string, Record<string, Record<string, OptionData[]>>> {
        return this.optionChainStore;
    }

    public getDashboard(): Record<string, Record<string, Record<string, { changeInPutVega: number; changeInCallVega: number }>>> {
        return this.dashboardStore;
    }

    public stopFetchingOptionChain(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log("Stopped fetching option chain data.");
        }
    }
}

export default OptionChainHandler;

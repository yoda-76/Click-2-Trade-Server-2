export interface OrderDetails {
  baseInstrument: string;
  instrumentType: "FUT" | "OPT" | "EQ";
  expiry: string | null;
  strike: number | null;
  optionType: "CE" | "PE" | null;
  exchange: "NSE" | "BSE";
  qty: number;
  price: number | null;
  triggerPrice: number | null;
  orderType: "LIMIT" | "MARKET";
  side: "BUY" | "SELL";
  productType: "D" | "I";
}

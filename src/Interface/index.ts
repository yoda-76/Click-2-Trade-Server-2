export interface OrderDetails {
  baseInstrument: string;
  instrumentType: "IDX-OPT"|"IDX-FUT"|"EQ-FUT"|"EQ-OPT"|"EQ";
  expiry: string | null;
  strike: number | null;
  optionType: "CE" | "PE" | null;
  exchange: "NSE" | "BSE";
  qty: number;
  price: number | null;
  triggerPrice: number | null;
  orderType: "LIMIT" | "MARKET";
  side: "BUY" | "SELL";
  productType: "D" | "I" | "INTRADAY" | "MARGIN";
}

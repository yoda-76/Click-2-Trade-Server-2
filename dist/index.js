"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./routes"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const node_http_1 = require("node:http");
const port = process.env.PORT || 3000;
const app = (0, express_1.default)();
const server = (0, node_http_1.createServer)(app);
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
//cors stuff
const allowedOrigins = ['http://localhost:5173', 'https://www.oidelta.com', 'https://oidelta.com', 'https://cliq2trade.com', 'https://www.cliq2trade.com']; // Define your allowed origins
app.use((req, res, next) => {
    const origin = req.headers.origin; // Get the origin of the incoming request
    // Check if the request's origin is in the list of allowed origins
    if (allowedOrigins.includes(origin)) {
        // console.log("origin matches",req.body);
        res.header("Access-Control-Allow-Origin", origin); // Set the Access-Control-Allow-Origin to the incoming origin
    }
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, userId, agentid, adminid, skey");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS"); // Specify allowed methods
    res.header("Access-Control-Allow-Credentials", "true"); // Allow credentials (cookies)
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200); // Quickly respond to preflight checks
    }
    next();
});
// DhanBroker.getInstance();
app.listen(port, () => {
    console.log(`App is running at http://localhost:${port}`);
    (0, routes_1.default)(app);
});
//# sourceMappingURL=index.js.map
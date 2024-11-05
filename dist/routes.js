"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_controller_1 = require("./controller/auth.controller");
const authenticate_1 = require("./middleware/authenticate");
const accounts_controller_1 = require("./controller/accounts.controller");
const broker_auth_1 = require("./controller/broker-auth");
const accountsManager_1 = require("./core/accountsManager");
const upstox_service_1 = require("./brokers/upstox.service");
const dhan_service_1 = require("./brokers/dhan/dhan.service");
const order_controller_1 = require("./controller/order.controller");
const positions_controller_1 = require("./controller/positions.controller");
const user_controller_1 = require("./controller/user.controller");
const option_chain_controller_1 = require("./controller/option-chain.controller");
function routes(app) {
    //health check
    app.get("/api/test", async (req, res) => {
        res.send("Server is healthy");
    });
    // auth
    app.post("/api/register", auth_controller_1.register);
    app.post("/api/login", auth_controller_1.login);
    app.post("/api/logout", authenticate_1.authenticate, auth_controller_1.logout);
    //change password
    //broker auth
    app.get("/api/upstox/auth", broker_auth_1.upstoxAuth);
    app.post("/api/dhan/auth", broker_auth_1.dhanAuth);
    app.post("/api/angel/auth", broker_auth_1.angelAuth);
    app.get("/api/kite/auth", broker_auth_1.zerodhaAuth);
    app.get("/api/optionchain/auth", option_chain_controller_1.optionChainAuthController);
    app.post("/api/fill-stores", authenticate_1.authenticate); //TODO
    // accounts
    app.post("/api/get-funds", authenticate_1.authenticate, accounts_controller_1.getFunds);
    app.post("/api/add-account", authenticate_1.authenticate, accounts_controller_1.addAccount);
    //tradeing console
    app.post("/api/get-funds", authenticate_1.authenticate, accounts_controller_1.getFunds);
    app.post("/api/place-order", authenticate_1.authenticate, order_controller_1.placeOrder);
    app.post("/api/cancel-order", authenticate_1.authenticate, order_controller_1.cancelOrder);
    app.post("/api/cancel-all-order", authenticate_1.authenticate, order_controller_1.cancelAllOrders); //TODO
    app.post("/api/get-orders", authenticate_1.authenticate, order_controller_1.getOrders);
    app.post("/api/get-positions", authenticate_1.authenticate, positions_controller_1.getPositions);
    app.post("api/get-user-prefrences", authenticate_1.authenticate, user_controller_1.getPrefrences);
    app.post("api/update-user-prefrences", authenticate_1.authenticate, user_controller_1.updatePrefrences);
    // user details
    app.post("/api/get-user-details", authenticate_1.authenticate, user_controller_1.getUserDetails); //not protected but doesnot need u_id
    // master acount
    app.post("/api/get-account-details", authenticate_1.authenticate, accounts_controller_1.getAccounts);
    app.post("/api/delete-master-account", authenticate_1.authenticate, accounts_controller_1.deleteMasterAccount);
    // child accounts
    app.post("/api/get-child-account-details", authenticate_1.authenticate, accounts_controller_1.getChildAccountByMasterUid);
    app.post("/api/update-multiplier", authenticate_1.authenticate, accounts_controller_1.updateChildMultiplier);
    app.post("/api/toggle-active", authenticate_1.authenticate, accounts_controller_1.toggleChildAccount);
    app.post("/api/delete-child-account", authenticate_1.authenticate, accounts_controller_1.deleteChildAccount);
    //square off
    app.post("/api/square-off-all", authenticate_1.authenticate, order_controller_1.squareoffAllPositions);
    app.post("/api/square-off-single", authenticate_1.authenticate, order_controller_1.squareoffSinglePositions);
    //predefined sl and target
    app.post("/api/update-prefrences", authenticate_1.authenticate, user_controller_1.updatePrefrences);
    // app.post("/api/update-prefrences-target", authenticate, updatePrefrenceTarget)
    app.post("/api/get-prefrences", authenticate_1.authenticate, user_controller_1.getPrefrences);
    //test
    app.post("/api/get-instrumentData", (req, res) => {
        const upstoxBroker = upstox_service_1.UpstoxBroker.getInstance();
        const instrumentData = upstoxBroker.getInstrumentDataAsObject();
        // const Broker = AngelOne.getInstance();
        // const instrumentData = Broker.getInstrumentDataAsObject();
        res.json(instrumentData);
    });
    app.post("/api/get-dhan-instrumentData", (req, res) => {
        const dhanBroker = dhan_service_1.DhanBroker.getInstance();
        const instrumentData = dhanBroker.getInstrumentDataAsObject();
        res.json(instrumentData);
    });
    app.post("/api/get-dhan-instrumentDataSearchMap", (req, res) => {
        const dhanBroker = dhan_service_1.DhanBroker.getInstance();
        const instrumentDataSearchMap = dhanBroker.getInstrumentDataSearchMapAsObject();
        res.json(instrumentDataSearchMap);
    });
    app.get("/api/get-tokens-to-be-subscribed", (req, res) => {
        const upstoxBroker = upstox_service_1.UpstoxBroker.getInstance();
        const tokens = upstoxBroker.getTokensToBeSubscribed();
        res.json({ tokens });
    });
    app.post("/api/get-instrumentDataSearchMap", (req, res) => {
        const upstoxBroker = upstox_service_1.UpstoxBroker.getInstance();
        const instrumentDataSearchMap = upstoxBroker.getInstrumentDataSearchMapAsObject();
        res.json(instrumentDataSearchMap);
    });
    app.post("/api/get-option-chain", option_chain_controller_1.optionChainController);
    app.post("/api/get-option-chain-dashboard", option_chain_controller_1.getOptionChainDashboard);
    app.post("/api/stop-option-chain-interval", option_chain_controller_1.stopOptionChainProcessing);
    app.post("/api/test-add-acc", async (req, res) => {
        const accountManager = accountsManager_1.AccountManager.getInstance();
        // Retrieve authenticated accounts
        const accounts = accountManager.getAllAuthenticatedAccountsAsObject();
        // Log the accounts map
        console.log("Authenticated Accounts:", accounts);
        res.json({ data: accounts, msg: "ok" });
    });
}
exports.default = routes;
//# sourceMappingURL=routes.js.map
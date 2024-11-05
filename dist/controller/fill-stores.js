"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fillAllStores = void 0;
const accountsManager_1 = require("core/accountsManager");
const fillAllStores = async (req, res) => {
    try {
        const userId = res.locals.user.id;
        const accountManager = accountsManager_1.AccountManager.getInstance();
        //prefrences
        //master account details
        //child account details
        //structured-options-data
        //positions
        //orderbook
        res.json({ message: 'Logged out successfully' });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.fillAllStores = fillAllStores;
//# sourceMappingURL=fill-stores.js.map
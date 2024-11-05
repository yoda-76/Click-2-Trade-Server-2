"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleChildAccount = exports.updateChildMultiplier = exports.getChildAccountByMasterUid = exports.getAccounts = exports.getFunds = exports.deleteChildAccount = exports.deleteMasterAccount = exports.addAccount = void 0;
const accountsManager_1 = require("../core/accountsManager");
const dbClient_1 = require("../utils/dbClient");
const addAccount = async (req, res) => {
    const { key, secret, broker, broker_id, type, master, u_id } = req.body;
    try {
        const user_id = res.locals.user.id;
        // console.log(user_id, req.body);
        const accountManager = accountsManager_1.AccountManager.getInstance();
        const account = await accountManager.addAccount(user_id, key, secret, broker, broker_id, type, master, u_id);
        res.json({ message: "Account created successfully", u_id: account.u_id });
    }
    catch (error) {
        console.log(error);
        res.status(400).json({ error: error.message });
    }
};
exports.addAccount = addAccount;
const deleteMasterAccount = async (req, res) => {
    const { master_u_id } = req.body;
    try {
        const accountManager = accountsManager_1.AccountManager.getInstance();
        await accountManager.deleteMasterAccount(`MASTER:${master_u_id}`);
        res.json({ message: "ok" });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.deleteMasterAccount = deleteMasterAccount;
const deleteChildAccount = async (req, res) => {
    const { child_u_id } = req.body;
    try {
        const accountManager = accountsManager_1.AccountManager.getInstance();
        await accountManager.deleteChildAccount(`CHILD:${child_u_id}`);
        res.json({ message: "ok" });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.deleteChildAccount = deleteChildAccount;
const getFunds = async (req, res) => {
    const { account_id } = req.body;
    // console.log(req.body);
    try {
        const accountManager = accountsManager_1.AccountManager.getInstance();
        const funds = await accountManager.getFunds(account_id);
        res.json({ message: "ok", funds });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getFunds = getFunds;
const getAccounts = async (req, res) => {
    try {
        const user_id = res.locals.user.id;
        const masterAccounts = await dbClient_1.dbClient.getMasterAccountsByUserId(user_id);
        const accounts = [];
        for (const masterAccount of masterAccounts) {
            const tempMasterAccount = Object.assign(Object.assign({}, masterAccount), { childAccounts: [] });
            const childAccounts = await dbClient_1.dbClient.getChildAccountsByMasterId(masterAccount.id);
            for (const childAccount of childAccounts) {
                if (childAccount.active) {
                    tempMasterAccount.childAccounts.push(childAccount);
                }
            }
            accounts.push(tempMasterAccount);
        }
        console.log(accounts);
        res.json({ message: "ok", accounts });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getAccounts = getAccounts;
const getChildAccountByMasterUid = async (req, res) => {
    try {
        const { id } = req.body;
        const accountManager = accountsManager_1.AccountManager.getInstance();
        const masterAccountId = accountManager.getAuthenticatedAccountId(id);
        const childAccounts = await dbClient_1.dbClient.getChildAccountsByMasterId(masterAccountId);
        res.json({ message: "ok", childAccounts });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getChildAccountByMasterUid = getChildAccountByMasterUid;
const updateChildMultiplier = async (req, res) => {
    try {
        const { child_u_id, multiplier } = req.body;
        const accountManager = accountsManager_1.AccountManager.getInstance();
        const childAccountId = accountManager.getAuthenticatedAccountId(`CHILD:${child_u_id}`);
        console.log(childAccountId);
        await dbClient_1.dbClient.updateChildAccountById(childAccountId, { multiplier });
        res.json({ message: "ok" });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.updateChildMultiplier = updateChildMultiplier;
const toggleChildAccount = async (req, res) => {
    try {
        const { child_u_id, status } = req.body;
        const accountManager = accountsManager_1.AccountManager.getInstance();
        const childAccountId = accountManager.getAuthenticatedAccountId(`CHILD:${child_u_id}`);
        await dbClient_1.dbClient.updateChildAccountById(childAccountId, { active: status });
        res.json({ message: "ok" });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.toggleChildAccount = toggleChildAccount;
//# sourceMappingURL=accounts.controller.js.map
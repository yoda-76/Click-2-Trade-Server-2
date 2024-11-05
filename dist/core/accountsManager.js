"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountManager = void 0;
const dbClient_1 = require("../utils/dbClient");
const upstox_service_1 = require("../brokers/upstox.service");
const dhan_service_1 = require("../brokers/dhan/dhan.service");
const angel_service_1 = require("../brokers/angel/angel.service");
class AccountManager {
    // Private constructor to prevent direct instantiation
    constructor() {
        this.authenticatedAccounts = new Map();
    }
    // Static method to get the singleton instance
    static getInstance() {
        if (!AccountManager.instance) {
            AccountManager.instance = new AccountManager();
        }
        return AccountManager.instance;
    }
    // Add authenticated account in in-memory store
    addAuthenticatedAccount(user_id, master_id, type, key, broker_id, accountId, id, accessToken, broker, dhanClientId) {
        const expiresAt = new Date(Date.now() + 3600 * 1000); // Assuming 1 hour expiry
        this.authenticatedAccounts.set(accountId, {
            id,
            user_id,
            key,
            accessToken,
            expiresAt,
            broker,
            broker_id,
            type,
            master_id,
            dhanClientId: dhanClientId ? dhanClientId : null
            //add active chind accounts too to reduce db calls
        });
    }
    // Get access token
    getAccessToken(accountId) {
        const account = this.authenticatedAccounts.get(accountId);
        if (account && account.expiresAt > new Date()) {
            return account.accessToken;
        }
        return undefined; // Token is either missing or expired
    }
    getBroker(accountId) {
        const account = this.authenticatedAccounts.get(accountId);
        if (account && account.expiresAt > new Date()) {
            return account.broker;
        }
        throw new Error('Account not authenticated'); // Token is either missing or expired
    }
    getAllAuthenticatedAccountsAsObject() {
        return Object.fromEntries(this.authenticatedAccounts);
    }
    getAuthenticatedAccountsAsObject(accountId) {
        console.log(Object.fromEntries(this.authenticatedAccounts)[accountId]);
        return Object.fromEntries(this.authenticatedAccounts)[accountId];
    }
    getAuthenticatedAccountId(accountId) {
        const account = this.authenticatedAccounts.get(accountId);
        if (account && account.expiresAt > new Date()) {
            return account.id;
        }
        return undefined;
    }
    async addAccount(user_id, key, secret, broker, broker_id, type, master, u_id) {
        if (type === "MASTER") {
            const masterAccount = await dbClient_1.dbClient.createMasterAccount(user_id, key, secret, broker, broker_id, u_id);
            return masterAccount;
        }
        else if (type === "CHILD") {
            const childAccount = await dbClient_1.dbClient.createChildAccount(user_id, key, secret, broker, broker_id, master, u_id);
            return childAccount;
        }
    }
    async deleteMasterAccount(accountId) {
        const account = this.authenticatedAccounts.get(accountId);
        if (!account || account.expiresAt < new Date()) {
            throw new Error('Account not authenticated');
        }
        await dbClient_1.dbClient.deleteMasterAccount(account.id);
        this.authenticatedAccounts.delete(accountId);
        return true;
    }
    async deleteChildAccount(accountId) {
        const account = this.authenticatedAccounts.get(accountId);
        if (!account || account.expiresAt < new Date()) {
            throw new Error('Account not authenticated');
        }
        await dbClient_1.dbClient.deleteChildAccount(account.id);
        this.authenticatedAccounts.delete(accountId);
        return true;
    }
    //get funds
    async getFunds(accountId) {
        try {
            // console.log("accountId", accountId);
            const account = this.authenticatedAccounts.get(accountId);
            // console.log(account);
            if (!account || account.expiresAt < new Date()) {
                // const allAccounts = this.getAllAuthenticatedAccountsAsObject();
                // console.log(allAccounts);
                throw new Error('Account not authenticated');
            }
            if (account.broker === "UPSTOCKS") {
                const upstoxBroker = upstox_service_1.UpstoxBroker.getInstance();
                const funds = await upstoxBroker.getFunds(account.accessToken);
                return funds;
            }
            else if (account.broker === "DHAN") {
                const dhanBroker = dhan_service_1.DhanBroker.getInstance();
                console.log(account);
                const funds = await dhanBroker.getFunds(account.accessToken);
                return funds;
            }
            else if (account.broker === "ANGEL") {
                console.log("Angel account : ", account);
                const angelBroker = angel_service_1.AngelOne.getInstance();
                const funds = await angelBroker.getFunds(account.accessToken, account.key);
                return funds;
            }
            else {
                throw new Error('Broker not supported');
            }
        }
        catch (error) {
            console.log(error);
            throw error;
        }
    }
}
exports.AccountManager = AccountManager;
//# sourceMappingURL=accountsManager.js.map
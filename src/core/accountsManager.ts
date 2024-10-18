import { dbClient } from "../utils/dbClient";
import { UpstoxBroker } from "../brokers/upstox.service";
import { DhanBroker } from "../brokers/dhan/dhan.service";

export class AccountManager {
    private static instance: AccountManager;
    private authenticatedAccounts: Map<string, { id: string, user_id: string, type: "MASTER" | "CHILD", master_id: string, broker_id: string, key: string, accessToken: string, expiresAt: Date, broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO" , dhanClientId: string|null}> = new Map();
  
    // Private constructor to prevent direct instantiation
    private constructor() {}
  
    // Static method to get the singleton instance
    public static getInstance(): AccountManager {
      if (!AccountManager.instance) {
        AccountManager.instance = new AccountManager();
      }
      return AccountManager.instance;
    }
  
    // Add authenticated account in in-memory store
    public addAuthenticatedAccount(user_id: string, master_id: string, type: "MASTER" | "CHILD", key: string, broker_id: string, accountId: string, id: string, accessToken: string, broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO", dhanClientId?: string|null) {
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
        dhanClientId: dhanClientId?dhanClientId:null
        //add active chind accounts too to reduce db calls
      });
    }
  
    // Get access token
    public getAccessToken(accountId: string): string | undefined {
      const account = this.authenticatedAccounts.get(accountId);
      if (account && account.expiresAt > new Date()) {
        return account.accessToken;
      }
      return undefined; // Token is either missing or expired
    }

    public getBroker(accountId: string): "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO" | undefined {
      const account = this.authenticatedAccounts.get(accountId);
      if (account && account.expiresAt > new Date()) {
        return account.broker;
      }
      throw new Error('Account not authenticated'); // Token is either missing or expired
    }

    public getAllAuthenticatedAccountsAsObject() {
      return Object.fromEntries(this.authenticatedAccounts);
    }

    public getAuthenticatedAccountsAsObject(accountId: string) {
      console.log(Object.fromEntries(this.authenticatedAccounts)[accountId]);
      return Object.fromEntries(this.authenticatedAccounts)[accountId];
    }

    public getAuthenticatedAccountId(accountId: string): string | undefined {
      const account = this.authenticatedAccounts.get(accountId);
      if (account && account.expiresAt > new Date()) {
        return account.id;
      }
      return undefined;
    }
    


    public async addAccount(
      user_id: string,
      key: string,
      secret: string,
      broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO",
      broker_id: string,
      type: string,
      master: string,
      u_id:string) {
       if(type === "MASTER"){
       const masterAccount = await dbClient.createMasterAccount(user_id, key, secret, broker, broker_id, u_id);
       return masterAccount;
       }else if(type === "CHILD"){
        const childAccount = await dbClient.createChildAccount(user_id, key, secret, broker, broker_id, master, u_id);
        return childAccount;
       }
    }

    public async deleteMasterAccount(accountId: string) {
      const account = this.authenticatedAccounts.get(accountId);
      if (!account || account.expiresAt < new Date()) {
        throw new Error('Account not authenticated');
      }
      await dbClient.deleteMasterAccount(account.id);
      this.authenticatedAccounts.delete(accountId);
      return true;
    }

    public async deleteChildAccount(accountId: string) {
      const account = this.authenticatedAccounts.get(accountId);
      if (!account || account.expiresAt < new Date()) {
        throw new Error('Account not authenticated');
      }
      await dbClient.deleteChildAccount(account.id);
      this.authenticatedAccounts.delete(accountId);
      return true;
    }

    //get funds
    public async getFunds(accountId: string): Promise<any> {
     try {
      // console.log("accountId", accountId);
      const account = this.authenticatedAccounts.get(accountId);
      // console.log(account);
      if (!account || account.expiresAt < new Date()) {
        // const allAccounts = this.getAllAuthenticatedAccountsAsObject();
        // console.log(allAccounts);
        throw new Error('Account not authenticated');
      }
      if(account.broker === "UPSTOCKS"){
        const upstoxBroker = UpstoxBroker.getInstance();
        const funds = await upstoxBroker.getFunds(account.accessToken);
        return funds;
      }else if(account.broker === "DHAN"){
        const dhanBroker = DhanBroker.getInstance();
        console.log(account);
        const funds = await dhanBroker.getFunds(account.accessToken);
        return funds;
      }else{
        throw new Error('Broker not supported');
      }
     } catch (error) {
      console.log(error);
      throw error;
     }
    }
  }
  
export declare class AccountManager {
    private static instance;
    private authenticatedAccounts;
    private constructor();
    static getInstance(): AccountManager;
    addAuthenticatedAccount(user_id: string, master_id: string, type: "MASTER" | "CHILD", key: string, broker_id: string, accountId: string, id: string, accessToken: string, broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO", dhanClientId?: string | null): void;
    getAccessToken(accountId: string): string | undefined;
    getBroker(accountId: string): "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO" | undefined;
    getAllAuthenticatedAccountsAsObject(): {
        [k: string]: {
            id: string;
            user_id: string;
            type: "MASTER" | "CHILD";
            master_id: string;
            broker_id: string;
            key: string;
            accessToken: string;
            expiresAt: Date;
            broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO";
            dhanClientId: string;
        };
    };
    getAuthenticatedAccountsAsObject(accountId: string): {
        id: string;
        user_id: string;
        type: "MASTER" | "CHILD";
        master_id: string;
        broker_id: string;
        key: string;
        accessToken: string;
        expiresAt: Date;
        broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO";
        dhanClientId: string;
    };
    getAuthenticatedAccountId(accountId: string): string | undefined;
    addAccount(user_id: string, key: string, secret: string, broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO", broker_id: string, type: string, master: string, u_id: string): Promise<{
        id: string;
        user_id: string;
        u_id: string;
        broker: import(".prisma/client").$Enums.Broker;
        broker_id: string;
        key: string;
        secret: string;
        access_token: string;
        last_token_generated_at: Date;
        pnl: number;
        added_at: Date;
        modified_at: Date;
    } | {
        id: string;
        master_id: string;
        u_id: string;
        broker: import(".prisma/client").$Enums.Broker;
        broker_id: string;
        key: string;
        secret: string;
        access_token: string;
        last_token_generated_at: Date;
        multiplier: number;
        active: boolean;
        added_at: Date;
        modified_at: Date;
        pnl: number;
    }>;
    deleteMasterAccount(accountId: string): Promise<boolean>;
    deleteChildAccount(accountId: string): Promise<boolean>;
    getFunds(accountId: string): Promise<any>;
}

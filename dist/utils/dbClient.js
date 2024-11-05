"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dbClient = void 0;
const db_1 = require("../lib/db");
class DBClient {
    //user
    async getUserByEmail(email) {
        return db_1.prisma.user.findUnique({
            where: { email },
        });
    }
    async createUser(data) {
        return db_1.prisma.user.create({
            data,
        });
        //create prefrences record
    }
    async getUserById(id) {
        return db_1.prisma.user.findUnique({
            where: { id },
        });
    }
    async createUserPrefrences(id) {
        return db_1.prisma.prefrences.create({
            data: {
                user_id: id,
            },
        });
    }
    async updateUserPrefrencesById(id, data) {
        return db_1.prisma.prefrences.update({
            where: { user_id: id },
            data,
        });
    }
    async getUserPrefrencesById(id) {
        return db_1.prisma.prefrences.findUnique({
            where: { user_id: id },
        });
    }
    // master account
    async createMasterAccount(user_id, key, secret, broker, broker_id, u_id) {
        try {
            const masterAccount = await db_1.prisma.masterAccount.create({
                data: {
                    user_id,
                    key,
                    secret,
                    broker,
                    broker_id,
                    u_id
                },
            });
            return masterAccount;
        }
        catch (error) {
            console.log(error);
        }
    }
    async deleteMasterAccount(id) {
        return db_1.prisma.masterAccount.delete({
            where: { id },
        });
    }
    async updateMasterAccountByUid(u_id, data) {
        return db_1.prisma.masterAccount.update({
            where: { u_id },
            data,
        });
    }
    async updateMasterAccessTokenByUid(u_id, data) {
        return db_1.prisma.masterAccount.update({
            where: { u_id },
            data,
        });
    }
    async updateMasterAccountById(id, data) {
        return db_1.prisma.masterAccount.update({
            where: { id },
            data,
        });
    }
    async getMasterAccountByUid(u_id) {
        return db_1.prisma.masterAccount.findUnique({
            where: { u_id },
        });
    }
    async getMasterAccountById(id) {
        return db_1.prisma.masterAccount.findUnique({
            where: { id },
        });
    }
    async getMasterAccounts() {
        return db_1.prisma.masterAccount.findMany();
    }
    async getMasterAccountsByUserId(user_id) {
        return db_1.prisma.masterAccount.findMany({
            where: { user_id },
        });
    }
    // child account
    async createChildAccount(email, key, secret, broker, broker_id, master, u_id) {
        try {
            const masterAccount = await db_1.prisma.masterAccount.findUnique({
                where: {
                    u_id: master,
                },
            });
            const childAccount = await db_1.prisma.childAccount.create({
                data: {
                    master_id: masterAccount.id,
                    key,
                    secret,
                    broker,
                    broker_id,
                    u_id
                },
            });
            return childAccount;
        }
        catch (error) {
            console.log(error);
        }
    }
    async deleteChildAccount(id) {
        return db_1.prisma.childAccount.delete({
            where: { id },
        });
    }
    async updateChildAccountByUid(u_id, data) {
        return db_1.prisma.childAccount.update({
            where: { u_id },
            data,
        });
    }
    async updateChildAccountById(id, data) {
        return db_1.prisma.childAccount.update({
            where: { id },
            data,
        });
    }
    async updateChildAccessTokenByUid(u_id, data) {
        return db_1.prisma.childAccount.update({
            where: { u_id },
            data,
        });
    }
    async getChildAccountByUid(u_id) {
        return db_1.prisma.childAccount.findUnique({
            where: { u_id },
        });
    }
    async getChildAccountById(id) {
        return db_1.prisma.childAccount.findUnique({
            where: { id },
        });
    }
    async getChildAccountsByMasterId(master_id) {
        return db_1.prisma.childAccount.findMany({
            where: { master_id },
        });
    }
    async getChildAccounts() {
        return db_1.prisma.childAccount.findMany();
    }
    async persistOrderbook(accountId, orderId, orderDetails, childOrders) {
        await db_1.prisma.orderBook.upsert({
            where: { order_id: orderId },
            create: {
                account_id: accountId,
                order_id: orderId,
                order_details: orderDetails,
                child_orders: childOrders
            },
            update: {
                order_details: orderDetails,
                child_orders: childOrders
            }
        });
        //save to db
    }
}
exports.dbClient = new DBClient();
//# sourceMappingURL=dbClient.js.map
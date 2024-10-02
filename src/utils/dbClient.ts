import { prisma } from '../lib/db';
import { ChildAccount, MasterAccount, User } from '@prisma/client';

class DBClient {

  //user
  async getUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async createUser(data: { name: string, email: string, password: string, ph_number:string, role: "USER" | "ADMIN" }) {
    return prisma.user.create({
      data,
    });
    //create prefrences record
  }

  async getUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  // master account
  async createMasterAccount(
    user_id: string,
    key: string,
    secret: string,
    broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO",
    broker_id: string,
    u_id:string) {
    try {
      const masterAccount=await prisma.masterAccount.create({
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
    } catch (error) {
      console.log(error);
    }
  }

  async updateMasterAccountByUid(u_id: string, data: MasterAccount) {
    return prisma.masterAccount.update({
      where: { u_id },
      data,
    });
  }

  async updateMasterAccessTokenByUid(u_id: string, data: {access_token: string, last_token_generated_at: Date}) {
    return prisma.masterAccount.update({
      where: { u_id },
      data,
    });
  }
  async updateMasterAccountById(id: string, data: MasterAccount) {
    return prisma.masterAccount.update({
      where: { id },
      data,
    });
  }

  async getMasterAccountByUid(u_id: string) {
    return prisma.masterAccount.findUnique({
      where: { u_id },
    });
  }

  async getMasterAccountById(id: string) {
    return prisma.masterAccount.findUnique({
      where: { id },
    });
  }

  async getMasterAccounts() {
    return prisma.masterAccount.findMany();
  }



  // child account

  async createChildAccount(
    email: string,
    key: string,
    secret: string,
    broker: "UPSTOCKS" | "DHAN" | "ANGEL" | "ESPRESSO",
    broker_id: string,
    master: string,
    u_id:string) {
    try {
      const masterAccount = await prisma.masterAccount.findUnique({
        where: {
          u_id:master,
        },
      });
      const childAccount = await prisma.childAccount.create({
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
    } catch (error) {
      console.log(error);
    }
  }

  async updateChildAccountByUid(u_id: string, data: ChildAccount) {
    return prisma.childAccount.update({
      where: { u_id },
      data,
    });
  }

  async updateChildAccountById(id: string, data: ChildAccount) {
    return prisma.childAccount.update({
      where: { id },
      data,
    });
  }

  async updateChildAccessTokenByUid(u_id: string, data: {access_token: string, last_token_generated_at: Date}) {
    return prisma.childAccount.update({
      where: { u_id },
      data,
    });
  }

  async getChildAccountByUid(u_id: string) {
    return prisma.childAccount.findUnique({
      where: { u_id },
    });
  }

  async getChildAccountById(id: string) {
    return prisma.childAccount.findUnique({
      where: { id },
    });
  }

  async getChildAccountsByMasterId(master_id: string) {
    return prisma.childAccount.findMany({
      where: { master_id },
    });
  }
  
  async getChildAccounts() {
    return prisma.childAccount.findMany();
  }
}

export const dbClient = new DBClient();

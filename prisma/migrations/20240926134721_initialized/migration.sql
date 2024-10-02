-- CreateEnum
CREATE TYPE "Broker" AS ENUM ('UPSTOCKS', 'DHAN', 'ANGEL', 'ESPRESSO');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "total_pnl" INTEGER NOT NULL DEFAULT 0,
    "ph_number" TEXT NOT NULL,
    "ph_number_verified" BOOLEAN NOT NULL DEFAULT false,
    "photo" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionExpiry" TIMESTAMP(3),
    "role" "Role" NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterAccount" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "u_id" TEXT NOT NULL,
    "broker" "Broker" NOT NULL,
    "broker_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "access_token" TEXT,
    "last_token_generated_at" TIMESTAMP(3),
    "pnl" INTEGER NOT NULL DEFAULT 0,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildAccount" (
    "id" TEXT NOT NULL,
    "master_id" TEXT NOT NULL,
    "u_id" TEXT NOT NULL,
    "broker" "Broker" NOT NULL,
    "broker_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "access_token" TEXT,
    "last_token_generated_at" TIMESTAMP(3),
    "multiplier" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pnl" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChildAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prefrences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "stoploss" INTEGER NOT NULL DEFAULT 100,
    "target" INTEGER NOT NULL DEFAULT 1000,
    "sl_increment" INTEGER NOT NULL DEFAULT 1,
    "target_increment" INTEGER NOT NULL DEFAULT 1,
    "trailing_point" INTEGER NOT NULL DEFAULT 1,
    "mtm_stoploss" INTEGER NOT NULL DEFAULT 100,
    "mtm_target" INTEGER NOT NULL DEFAULT 1000,
    "mtm_sl_increment" INTEGER NOT NULL DEFAULT 1,
    "mtm_target_increment" INTEGER NOT NULL DEFAULT 1,
    "mtm_trailing_point" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Prefrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MasterAccount_u_id_key" ON "MasterAccount"("u_id");

-- CreateIndex
CREATE UNIQUE INDEX "MasterAccount_broker_id_key" ON "MasterAccount"("broker_id");

-- CreateIndex
CREATE UNIQUE INDEX "ChildAccount_u_id_key" ON "ChildAccount"("u_id");

-- CreateIndex
CREATE UNIQUE INDEX "ChildAccount_broker_id_key" ON "ChildAccount"("broker_id");

-- CreateIndex
CREATE UNIQUE INDEX "Prefrences_user_id_key" ON "Prefrences"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_ref_id_key" ON "Transaction"("ref_id");

-- AddForeignKey
ALTER TABLE "MasterAccount" ADD CONSTRAINT "MasterAccount_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildAccount" ADD CONSTRAINT "ChildAccount_master_id_fkey" FOREIGN KEY ("master_id") REFERENCES "MasterAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prefrences" ADD CONSTRAINT "Prefrences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

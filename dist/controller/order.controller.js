"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.squareoffAllPositions = exports.squareoffSinglePositions = exports.getOrders = exports.cancelAllOrders = exports.cancelOrder = exports.placeOrder = void 0;
const orders_1 = require("../core/orders");
const placeOrder = async (req, res) => {
    const { accountId, baseInstrument, instrumentType, expiry, strike, optionType, exchange, qty, price, triggerPrice, orderType, side, productType } = req.body;
    try {
        console.log(req.body);
        const orderManager = await orders_1.OrderManager.getInstance();
        const order = await orderManager.placeOrder(accountId, { baseInstrument, instrumentType, expiry, strike, optionType, exchange, qty, price, triggerPrice, orderType, side, productType });
        res.json({ message: "Order placed successfully", order });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.placeOrder = placeOrder;
const cancelOrder = async (req, res) => {
    const { accountId, orderId } = req.body;
    try {
        const orderManager = await orders_1.OrderManager.getInstance();
        await orderManager.cancelOrder(accountId, orderId);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.cancelOrder = cancelOrder;
const cancelAllOrders = async (req, res) => {
    const { accountId } = req.body;
    try {
        const orderManager = await orders_1.OrderManager.getInstance();
        await orderManager.cancelAllOrders(accountId);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.cancelAllOrders = cancelAllOrders;
const getOrders = async (req, res) => {
    const { accountId } = req.body;
    try {
        const orderManager = await orders_1.OrderManager.getInstance();
        const orders = await orderManager.getOrderBook(accountId);
        // console.log("orders: ", orders);
        res.json(orders);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getOrders = getOrders;
const squareoffSinglePositions = async (req, res) => {
    const { account_id, position } = req.body;
    try {
        const orderManager = await orders_1.OrderManager.getInstance();
        await orderManager.exitSinglePosition(account_id, position);
        res.json({ message: "Position exited successfully" });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.squareoffSinglePositions = squareoffSinglePositions;
const squareoffAllPositions = async (req, res) => {
    const { account_id } = req.body;
    try {
        const orderManager = await orders_1.OrderManager.getInstance();
        await orderManager.exitAllPositions(account_id);
        res.json({ message: "All positions exited successfully" });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.squareoffAllPositions = squareoffAllPositions;
//# sourceMappingURL=order.controller.js.map
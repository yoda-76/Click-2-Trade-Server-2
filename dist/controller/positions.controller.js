"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrackedPositions = exports.getPositions = void 0;
const orders_1 = require("../core/orders");
const getPositions = async (req, res) => {
    const { account_id } = req.body;
    try {
        const positions = await orders_1.OrderManager.getInstance().getPositions(account_id);
        console.log("positions", positions);
        res.json(positions);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getPositions = getPositions;
const getTrackedPositions = async (req, res) => {
    const { accountId } = req.body;
    try {
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getTrackedPositions = getTrackedPositions;
//# sourceMappingURL=positions.controller.js.map
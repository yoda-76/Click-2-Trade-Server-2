"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stopOptionChainProcessing = exports.getOptionChainDashboard = exports.optionChainAuthController = exports.optionChainController = void 0;
const OptionChainService_1 = __importDefault(require("../core/OptionChainService"));
const optionChainController = async (req, res) => {
    // const {accountId, expiry, base} = req.body;
    const optionChainInstance = OptionChainService_1.default.getInstance();
    const optionChain = await optionChainInstance.getOptionChain();
    res.json(optionChain);
};
exports.optionChainController = optionChainController;
const optionChainAuthController = async (req, res) => {
    const authcode = req.query.code;
    console.log(authcode);
    try {
        const optionChainInstance = OptionChainService_1.default.getInstance();
        const msg = await optionChainInstance.storeAccessToken(authcode);
        res.json({ message: msg });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.optionChainAuthController = optionChainAuthController;
const getOptionChainDashboard = async (req, res) => {
    const optionChainInstance = OptionChainService_1.default.getInstance();
    const optionChainDashBoard = await optionChainInstance.getDashboard();
    res.json(optionChainDashBoard);
};
exports.getOptionChainDashboard = getOptionChainDashboard;
const stopOptionChainProcessing = async (req, res) => {
    const optionChainInstance = OptionChainService_1.default.getInstance();
    const optionChainDashBoard = await optionChainInstance.stopFetchingOptionChain();
    res.json(optionChainDashBoard);
};
exports.stopOptionChainProcessing = stopOptionChainProcessing;
//# sourceMappingURL=option-chain.controller.js.map
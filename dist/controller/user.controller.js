"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPrefrences = exports.updatePrefrences = exports.getUserDetails = void 0;
const dbClient_1 = require("../utils/dbClient");
//get user details
const getUserDetails = async (req, res) => {
    try {
        const userId = res.locals.user.id;
        const userDetails = await dbClient_1.dbClient.getUserById(userId);
        res.json({ message: "ok", data: {
                name: userDetails.name,
                email: userDetails.email,
                verified: userDetails.verified
            } });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getUserDetails = getUserDetails;
//update password
//update preferences
const updatePrefrences = async (req, res) => {
    try {
        const userId = res.locals.user.id;
        const resp = await dbClient_1.dbClient.updateUserPrefrencesById(userId, req.body);
        res.json({ message: "ok" });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.updatePrefrences = updatePrefrences;
const getPrefrences = async (req, res) => {
    try {
        const userId = res.locals.user.id;
        const resp = await dbClient_1.dbClient.getUserPrefrencesById(userId);
        res.json({ message: "ok", data: resp });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getPrefrences = getPrefrences;
//# sourceMappingURL=user.controller.js.map
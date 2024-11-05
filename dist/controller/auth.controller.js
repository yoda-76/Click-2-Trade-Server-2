"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.login = exports.register = void 0;
const auth_service_1 = require("../service/auth.service");
const register = async (req, res) => {
    const { name, email, password, ph_number } = req.body;
    try {
        const user = await auth_service_1.authService.register(name, email, password, ph_number);
        res.json(user);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.register = register;
const login = async (req, res) => {
    const { email, password } = req.body;
    console.log(email, password);
    try {
        const authenticatedUser = await auth_service_1.authService.login(email, password);
        const { name, verified, token } = authenticatedUser;
        res.cookie("atc", token, {
            httpOnly: true,
            secure: true, // Only use secure cookies in production
            sameSite: 'none', // Helps prevent CSRF
            maxAge: 24 * 3600 * 1000, // Expiry time in milliseconds
        });
        res.json({ Message: "Logged in successfully", data: { name, email, verified, token } });
    }
    catch (error) {
        console.log(error);
        res.status(400).json({ error: error.message });
    }
};
exports.login = login;
const logout = async (req, res) => {
    const userId = res.locals.user.id;
    await auth_service_1.authService.logout(userId);
    res.json({ message: 'Logged out successfully' });
};
exports.logout = logout;
//# sourceMappingURL=auth.controller.js.map
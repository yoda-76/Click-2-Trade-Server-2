"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = void 0;
const auth_service_1 = require("../service/auth.service");
const authenticate = async (req, res, next) => {
    // const sessionToken = req.headers.authorization?.split(' ')[1]; // Bearer <token>
    const sessionToken = req.cookies.atc;
    console.log("cookies", req.cookies);
    if (!sessionToken) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = await auth_service_1.authService.getUserBySessionToken(sessionToken);
    if (!user) {
        return res.status(401).json({ error: 'Invalid session' });
    }
    res.locals.user = user;
    next();
};
exports.authenticate = authenticate;
//# sourceMappingURL=authenticate.js.map
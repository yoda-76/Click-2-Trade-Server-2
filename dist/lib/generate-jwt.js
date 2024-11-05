"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRefreshToken = exports.generateVerificationToken = exports.generateAccessToken = exports.generateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const generateToken = (user) => {
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
};
exports.generateToken = generateToken;
const generateAccessToken = (user) => {
    console.log(process.env.ACCESS_TOKEN_EXPIRY);
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY });
};
exports.generateAccessToken = generateAccessToken;
const generateVerificationToken = (user) => {
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT_VERIFICATION_SECRET, { expiresIn: process.env.VERIFICATION_TOKEN_EXPIRY });
};
exports.generateVerificationToken = generateVerificationToken;
const generateRefreshToken = (user) => {
    // return jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1d" });
    return jsonwebtoken_1.default.sign({ id: user.id, email: user.email }, process.env.JWT_REFRESH_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY } //1 week
    );
};
exports.generateRefreshToken = generateRefreshToken;
//# sourceMappingURL=generate-jwt.js.map
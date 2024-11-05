"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
// src/models/user.ts
class User {
    constructor(id, name, email, password, ph_number, ph_number_verified, photo, verified, subscriptionExpiry, role) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.password = password;
        this.ph_number = ph_number;
        this.ph_number_verified = ph_number_verified;
        this.photo = photo || undefined;
        this.verified = verified;
        this.subscriptionExpiry = subscriptionExpiry || undefined;
        this.role = role;
    }
}
exports.User = User;
//# sourceMappingURL=user.js.map
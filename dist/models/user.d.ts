export declare class User {
    id: string;
    name: string;
    email: string;
    password: string;
    ph_number: string;
    ph_number_verified: boolean;
    photo?: string;
    verified: boolean;
    subscriptionExpiry?: Date;
    role: string;
    constructor(id: string, name: string, email: string, password: string, ph_number: string, ph_number_verified: boolean, photo: string | null, verified: boolean, subscriptionExpiry: Date | null, role: string);
}

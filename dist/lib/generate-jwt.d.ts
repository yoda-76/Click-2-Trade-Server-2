export declare const generateToken: (user: {
    id: string;
    email: string;
}) => string;
export declare const generateAccessToken: (user: any) => string;
export declare const generateVerificationToken: (user: any) => string;
export declare const generateRefreshToken: (user: any) => string;

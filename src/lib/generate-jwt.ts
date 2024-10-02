import jwt from 'jsonwebtoken';

export const generateToken = (user: { id: string, email: string }) => {
    return jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' }
    );
};

export const generateAccessToken = (user) => {
    console.log(process.env.ACCESS_TOKEN_EXPIRY);
    return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.ACCESS_TOKEN_EXPIRY });
  };
  export const generateVerificationToken = (user) => {
    return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_VERIFICATION_SECRET, { expiresIn: process.env.VERIFICATION_TOKEN_EXPIRY });
  };

  export const generateRefreshToken = (user) => {
    // return jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "1d" });
    return jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_REFRESH_SECRET as string,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY } //1 week
  )
  };
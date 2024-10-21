import { Request, Response, NextFunction } from 'express';
import { authService } from '../service/auth.service';
  
export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  // const sessionToken = req.headers.authorization?.split(' ')[1]; // Bearer <token>
  const sessionToken = req.cookies.atc;
  console.log("cookies", req.cookies);

  if (!sessionToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const user = await authService.getUserBySessionToken(sessionToken);
  if (!user) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  res.locals.user = user;
  next();
};
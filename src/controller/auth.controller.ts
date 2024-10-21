import { Request, Response } from "express";
import {  authService } from "../service/auth.service";

export const register = async (req: Request, res: Response) => {
  const { name, email, password, ph_number } = req.body;
  try {
    const user = await authService.register(name, email, password, ph_number);
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  console.log(email, password);
  try {
    const authenticatedUser = await authService.login(email, password);
    const {name, verified, token} = authenticatedUser;
    res.cookie("atc", token, {
      httpOnly: true,
      secure: true, // Only use secure cookies in production
      // sameSite: 'Strict', // Helps prevent CSRF
      maxAge: 24 * 3600 * 1000, // Expiry time in milliseconds
    });
    res.json({ Message: "Logged in successfully", data:{name, email, verified, token}});
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
}

export const logout = async (req: Request, res: Response) => {
  const userId = res.locals.user.id;
  await authService.logout(userId);
  res.json({ message: 'Logged out successfully' });
}
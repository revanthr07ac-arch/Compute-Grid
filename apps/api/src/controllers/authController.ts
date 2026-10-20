import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/db.js';
import { ENV } from '../config/env.js';
import { RegisterSchema, LoginSchema } from '@computegrid/shared';

export class AuthController {
  public static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = RegisterSchema.parse(req.body);

      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email: data.email }, { username: data.username }],
        },
      });

      if (existingUser) {
        res.status(409).json({
          success: false,
          error: 'User with this email or username already exists',
        });
        return;
      }

      const passwordHash = await bcrypt.hash(data.password, 10);
      const isFirstUser = (await prisma.user.count()) === 0;

      const user = await prisma.user.create({
        data: {
          email: data.email,
          username: data.username,
          passwordHash,
          role: isFirstUser ? 'ADMIN' : 'USER',
        },
      });

      const token = jwt.sign(
        { userId: user.id, email: user.email, username: user.username, role: user.role },
        ENV.JWT_SECRET,
        { expiresIn: ENV.JWT_EXPIRES_IN as any }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
          },
          token,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = LoginSchema.parse(req.body);

      const user = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const valid = await bcrypt.compare(data.password, user.passwordHash);
      if (!valid) {
        res.status(401).json({ success: false, error: 'Invalid email or password' });
        return;
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email, username: user.username, role: user.role },
        ENV.JWT_SECRET,
        { expiresIn: ENV.JWT_EXPIRES_IN as any }
      );

      res.cookie('token', token, {
        httpOnly: true,
        secure: ENV.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            createdAt: user.createdAt,
          },
          token,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  public static async logout(req: Request, res: Response): Promise<void> {
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
  }

  public static async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  }
}

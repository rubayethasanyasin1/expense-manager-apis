import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database.js';
import { createDefaultCategories, createDefaultWallets } from '../utils/defaultCategories.js';
import AppError from '../utils/AppError.js';

class AuthService {
  async registerUser(email, password, name) {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already registered', 400);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    await createDefaultCategories(user.id);
    await createDefaultWallets(user.id);

    const token = this.generateToken(user.id);

    return { user, token };
  }

  async loginUser(email, password) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    if (user.authProvider !== 'local' && !user.password) {
      throw new AppError(`This account is registered with ${user.authProvider}. Please use ${user.authProvider} to log in.`, 401);
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    const token = this.generateToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar
      },
      token
    };
  }

  async getUserProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        authProvider: true,
        createdAt: true
      }
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return user;
  }

  async updateUserProfile(userId, { name, email, password }) {
    const updateData = {};

    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.id !== userId) {
        throw new AppError('Email already in use', 400);
      }
      updateData.email = email;
    }

    if (name) {
      updateData.name = name;
    }

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    return user;
  }

  generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    });
  }
}

export default new AuthService();

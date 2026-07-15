import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';

class WalletService {
  async getWallets(userId) {
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });
    return { wallets };
  }

  async createWallet(userId, { name, color, icon, balance }) {
    const existingWallet = await prisma.wallet.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' }
      }
    });

    if (existingWallet) {
      throw new AppError('A wallet with this name already exists', 400);
    }

    const wallet = await prisma.wallet.create({
      data: {
        name,
        color,
        icon,
        balance: balance !== undefined ? parseFloat(balance) : 0.0,
        userId
      }
    });

    return wallet;
  }

  async updateWallet(userId, id, { name, color, icon, balance }) {
    const existingWallet = await prisma.wallet.findFirst({
      where: { id, userId }
    });

    if (!existingWallet) {
      throw new AppError('Wallet not found', 404);
    }

    if (name && name.toLowerCase() !== existingWallet.name.toLowerCase()) {
      const duplicateWallet = await prisma.wallet.findFirst({
        where: {
          userId,
          name: { equals: name, mode: 'insensitive' }
        }
      });
      if (duplicateWallet) {
        throw new AppError('A wallet with this name already exists', 400);
      }
    }

    const updatedWallet = await prisma.wallet.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(balance !== undefined && { balance: parseFloat(balance) })
      }
    });

    return updatedWallet;
  }

  async deleteWallet(userId, id) {
    const wallet = await prisma.wallet.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: {
            expenses: true,
            incomingTransfers: true
          }
        }
      }
    });

    if (!wallet) {
      throw new AppError('Wallet not found', 404);
    }

    if (wallet._count.expenses > 0 || wallet._count.incomingTransfers > 0) {
      throw new AppError('Cannot delete wallet because it has associated transactions', 400);
    }

    await prisma.wallet.delete({
      where: { id }
    });

    return true;
  }
}

export default new WalletService();

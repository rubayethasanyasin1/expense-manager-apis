import prisma from '../config/database.js';

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
      const error = new Error('A wallet with this name already exists');
      error.status = 400;
      throw error;
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
      const error = new Error('Wallet not found');
      error.status = 404;
      throw error;
    }

    if (name && name.toLowerCase() !== existingWallet.name.toLowerCase()) {
      const duplicateWallet = await prisma.wallet.findFirst({
        where: {
          userId,
          name: { equals: name, mode: 'insensitive' }
        }
      });
      if (duplicateWallet) {
        const error = new Error('A wallet with this name already exists');
        error.status = 400;
        throw error;
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
      const error = new Error('Wallet not found');
      error.status = 404;
      throw error;
    }

    if (wallet._count.expenses > 0 || wallet._count.incomingTransfers > 0) {
      const error = new Error('Cannot delete wallet because it has associated transactions');
      error.status = 400;
      throw error;
    }

    await prisma.wallet.delete({
      where: { id }
    });

    return true;
  }
}

export default new WalletService();

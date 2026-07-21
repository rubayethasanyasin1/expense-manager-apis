import prisma from '../config/database.js';
import AppError from '../utils/AppError.js';

class CategoryService {
  async getCategories(userId) {
    const categories = await prisma.category.findMany({
      where: { userId },
      include: {
        _count: {
          select: { expenses: true }
        }
      },
      orderBy: [
        { expenses: { _count: 'desc' } },
        { createdAt: 'desc' }
      ]
    });
    return { categories };
  }

  async getCategoryById(userId, id) {
    const category = await prisma.category.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { expenses: true }
        }
      }
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    return category;
  }

  async getCategoryStats(userId) {
    const categories = await prisma.category.findMany({
      where: { userId },
      include: {
        _count: {
          select: { expenses: true }
        }
      }
    });

    const categoryStats = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      color: cat.color,
      icon: cat.icon,
      type: cat.type,
      expenseCount: cat._count.expenses
    }));

    return { categories: categoryStats };
  }

  async createCategory(userId, { name, color, icon, type }) {
    const existingCategory = await prisma.category.findFirst({
      where: {
        userId,
        name: { equals: name, mode: 'insensitive' },
        type
      }
    });

    if (existingCategory) {
      throw new AppError(`A category with this name already exists for ${type}`, 400);
    }

    const category = await prisma.category.create({
      data: {
        name,
        color,
        icon,
        type: type || 'EXPENSE',
        userId
      }
    });

    return category;
  }

  async updateCategory(userId, id, { name, color, icon, type }) {
    const existingCategory = await prisma.category.findFirst({
      where: { id, userId }
    });

    if (!existingCategory) {
      throw new AppError('Category not found', 404);
    }

    if (name && name.toLowerCase() !== existingCategory.name.toLowerCase()) {
      const duplicateCategory = await prisma.category.findFirst({
        where: {
          userId,
          name: { equals: name, mode: 'insensitive' },
          type: type || existingCategory.type
        }
      });
      if (duplicateCategory) {
        throw new AppError('A category with this name already exists', 400);
      }
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(type && { type })
      }
    });

    return updatedCategory;
  }

  async deleteCategory(userId, id) {
    const category = await prisma.category.findFirst({
      where: { id, userId },
      include: {
        _count: {
          select: { expenses: true }
        }
      }
    });

    if (!category) {
      throw new AppError('Category not found', 404);
    }

    if (category._count.expenses > 0) {
      throw new AppError('Cannot delete category because it has associated expenses', 400);
    }

    await prisma.category.delete({
      where: { id }
    });

    return true;
  }
}

export default new CategoryService();

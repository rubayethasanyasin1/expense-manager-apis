import prisma from '../config/database.js';

class CategoryService {
  async createCategory(userId, { name, color, icon }) {
    // Check if category with same name already exists for this user
    const existingCategory = await prisma.category.findUnique({
      where: {
        userId_name: {
          userId,
          name
        }
      }
    });

    if (existingCategory) {
      const error = new Error('Category with this name already exists');
      error.status = 409;
      throw error;
    }

    const category = await prisma.category.create({
      data: {
        name,
        color,
        icon,
        userId
      }
    });

    return category;
  }

  async getCategories(userId, { page = 1, limit = 50, search = '', sortBy = 'updatedAt', sortOrder = 'desc' }) {
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {
      userId,
      ...(search && {
        name: {
          contains: search,
          mode: 'insensitive'
        }
      })
    };

    // Build orderBy clause
    const validSortFields = ['name', 'createdAt', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'updatedAt';
    const order = sortOrder === 'asc' ? 'asc' : 'desc';

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: {
          [sortField]: order
        },
        include: {
          _count: {
            select: { expenses: true }
          }
        }
      }),
      prisma.category.count({
        where
      })
    ]);

    return {
      categories,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  }

  async getCategoryById(userId, id) {
    const category = await prisma.category.findFirst({
      where: {
        id,
        userId
      },
      include: {
        _count: {
          select: { expenses: true }
        }
      }
    });

    if (!category) {
      const error = new Error('Category not found');
      error.status = 404;
      throw error;
    }

    return category;
  }

  async updateCategory(userId, id, { name, color, icon }) {
    // Check if category exists and belongs to user
    const existingCategory = await prisma.category.findFirst({
      where: {
        id,
        userId
      }
    });

    if (!existingCategory) {
      const error = new Error('Category not found');
      error.status = 404;
      throw error;
    }

    // Check if new name conflicts with another category
    if (name && name !== existingCategory.name) {
      const nameConflict = await prisma.category.findUnique({
        where: {
          userId_name: {
            userId,
            name
          }
        }
      });

      if (nameConflict) {
        const error = new Error('Category with this name already exists');
        error.status = 409;
        throw error;
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon })
      }
    });

    return category;
  }

  async deleteCategory(userId, id) {
    // Check if category exists and belongs to user
    const category = await prisma.category.findFirst({
      where: {
        id,
        userId
      },
      include: {
        _count: {
          select: { expenses: true }
        }
      }
    });

    if (!category) {
      const error = new Error('Category not found');
      error.status = 404;
      throw error;
    }

    // Check if category has associated expenses
    if (category._count.expenses > 0) {
      const error = new Error('Cannot delete category with associated expenses');
      error.status = 409;
      error.expenseCount = category._count.expenses;
      throw error;
    }

    await prisma.category.delete({
      where: { id }
    });

    return true;
  }
}

export default new CategoryService();

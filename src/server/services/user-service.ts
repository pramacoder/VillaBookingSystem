import type { PrismaClient, UserRole } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { createUserSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/server/auth/password";

export interface SafeUserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listUsers(prisma: PrismaClient): Promise<SafeUserDto[]> {
  return prisma.user.findMany({
    select: SAFE_USER_SELECT,
    orderBy: { createdAt: "asc" },
  });
}

export async function createUser(
  prisma: PrismaClient,
  actorUserId: string,
  rawInput: unknown,
  ipAddress?: string,
): Promise<SafeUserDto> {
  const input = createUserSchema.parse(rawInput);
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      throw new AppError("BUSINESS_RULE", 409, "A user with this email already exists.");
    }

    const created = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash,
        isActive: true,
      },
      select: SAFE_USER_SELECT,
    });

    await tx.auditLog.create({
      data: {
        actorId: actorUserId,
        action: "user.create",
        entityType: "User",
        entityId: created.id,
        metadata: {
          id: created.id,
          email: created.email,
          name: created.name,
          role: created.role,
          isActive: created.isActive,
          ipAddress: ipAddress ?? null,
        },
      },
    });

    return created;
  });
}

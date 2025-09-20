import { Document, Types } from 'mongoose';
import { UserDocument } from '../schemas/user.schema';
import type { UserForJWT, UserPublicInfo } from '../types';

interface UserWithId extends UserDocument {
  _id: Types.ObjectId;
}

export class UserMapper {
  /**
   * Convierte un UserDocument de MongoDB a la información pública que usa el frontend
   * Usa UUID como ID público, nunca expone el _id de MongoDB
   */
  static toPublicInfo(user: UserDocument): UserPublicInfo {
    return {
      id: (user as UserWithId)._id.toString(), // MongoDB ObjectId como ID
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      phoneNumber: user.phoneNumber,
      isPhoneVerified: user.isPhoneVerified,
      preferences: user.preferences,
      status: user.status,
      createdAt: user.createdAt || new Date(),
      updatedAt: user.updatedAt || new Date()
    };
  }

  /**
   * Convierte un UserDocument para usar en JWT tokens
   * Usa MongoDB ObjectId como identificador
   */
  static toJWTUser(user: UserDocument): UserForJWT {
    return {
      id: (user as UserWithId)._id.toString(), // MongoDB ObjectId como ID
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      fullName: `${user.firstName} ${user.lastName}`.trim(),
      activeProfileId: user.activeProfileId?.toString()
    };
  }

  /**
   * Obtiene el MongoDB ObjectId de un usuario
   * Método helper para acceder al _id interno cuando sea necesario
   */
  static getMongoId(user: UserDocument): string {
    return (user as UserWithId)._id.toString();
  }

  /**
   * Verifica si un ID es un UUID válido
   */
  static isValidUUID(id: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id);
  }

  /**
   * Verifica si un ID es un ObjectId válido de MongoDB
   */
  static isValidMongoId(id: string): boolean {
    return Types.ObjectId.isValid(id);
  }
}

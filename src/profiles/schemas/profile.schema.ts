import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ProfileType } from 'src/financial-profiles/schemas';

export type ProfileDocument = Profile &
  Document & {
    _id: Types.ObjectId;
    totalMembers: number;
    isPersonal: boolean;
    isShared: boolean;
    createdAt: Date;
    updatedAt: Date;
  };

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})
export class Profile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ProfileType),
    required: true,
    index: true
  })
  type: ProfileType;

  @Prop({
    type: String,
    required: true,
    minlength: 2,
    maxlength: 100,
    trim: true
  })
  name: string;

  @Prop({
    type: String,
    maxlength: 500,
    trim: true
  })
  description?: string;

  @Prop({
    type: String,
    default: 'USD',
    match: /^[A-Z]{3}$/,
    uppercase: true
  })
  currency: string;

  @Prop({
    type: String,
    default: 'America/Argentina/Buenos_Aires'
  })
  timezone: string;

  // Settings específicos del perfil
  @Prop({
    type: {
      privacy: {
        transactionVisibility: {
          type: String,
          enum: ['private', 'members_only', 'public'],
          default: 'private'
        },
        reportVisibility: {
          type: String,
          enum: ['private', 'members_only', 'public'],
          default: 'private'
        },
        budgetVisibility: {
          type: String,
          enum: ['private', 'members_only', 'public'],
          default: 'private'
        },
        allowPrivateTransactions: { type: Boolean, default: true },
        childTransactionLimit: { type: Number, min: 0 },
        requireApproval: { type: Boolean, default: false },
        approvalThreshold: { type: Number, min: 0 }
      },
      notifications: {
        enabled: { type: Boolean, default: true },
        frequency: {
          type: String,
          enum: ['instant', 'daily', 'weekly', 'monthly'],
          default: 'daily'
        },
        channels: [
          {
            type: String,
            enum: ['email', 'whatsapp', 'telegram', 'push']
          }
        ]
      },
      preferences: {
        dateFormat: {
          type: String,
          enum: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD-MM-YYYY'],
          default: 'DD/MM/YYYY'
        },
        timeFormat: {
          type: String,
          enum: ['12h', '24h'],
          default: '24h'
        },
        weekStartDay: {
          type: String,
          enum: ['sunday', 'monday'],
          default: 'monday'
        },
        autoCategorizationEnabled: { type: Boolean, default: true },
        receiptScanningEnabled: { type: Boolean, default: true }
      }
    },
    default: () => ({})
  })
  settings: {
    privacy?: {
      transactionVisibility?: 'private' | 'members_only' | 'public';
      reportVisibility?: 'private' | 'members_only' | 'public';
      budgetVisibility?: 'private' | 'members_only' | 'public';
      allowPrivateTransactions?: boolean;
      childTransactionLimit?: number;
      requireApproval?: boolean;
      approvalThreshold?: number;
    };
    notifications?: {
      enabled?: boolean;
      frequency?: 'instant' | 'daily' | 'weekly' | 'monthly';
      channels?: ('email' | 'whatsapp' | 'telegram' | 'push')[];
    };
    preferences?: {
      dateFormat?: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'DD-MM-YYYY';
      timeFormat?: '12h' | '24h';
      weekStartDay?: 'sunday' | 'monday';
      autoCategorizationEnabled?: boolean;
      receiptScanningEnabled?: boolean;
    };
  };

  // Miembros del perfil (para couple, family, business)
  @Prop({
    type: [{ type: Types.ObjectId, ref: 'User' }],
    default: [],
    validate: {
      validator: function (members: Types.ObjectId[]) {
        // Validaciones específicas por tipo
        if (this.type === ProfileType.PERSONAL && members.length > 0) {
          return false; // Personal no puede tener miembros adicionales
        }
        if (this.type === ProfileType.COUPLE && members.length > 1) {
          return false; // Pareja máximo 1 miembro adicional
        }
        if (this.type === ProfileType.FAMILY && members.length > 10) {
          return false; // Familia máximo 10 miembros adicionales
        }
        if (this.type === ProfileType.BUSINESS && members.length > 50) {
          return false; // Business máximo 50 miembros adicionales
        }
        return true;
      },
      message: 'Invalid number of members for this profile type'
    }
  })
  members: Types.ObjectId[];

  // Referencias a datos del perfil
  @Prop({ type: [{ type: Types.ObjectId, ref: 'Transaction' }], default: [] })
  transactions: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Budget' }], default: [] })
  budgets: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Goal' }], default: [] })
  goals: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Category' }], default: [] })
  categories: Types.ObjectId[];

  // Status del perfil
  @Prop({
    type: String,
    enum: ['active', 'inactive', 'archived'],
    default: 'active'
  })
  status: 'active' | 'inactive' | 'archived';

  @Prop({ type: Date, default: Date.now })
  lastUsedAt: Date;
}

export const ProfileSchema = SchemaFactory.createForClass(Profile);

// Índices compuestos
ProfileSchema.index({ userId: 1, type: 1 });
ProfileSchema.index({ userId: 1, status: 1 });
ProfileSchema.index({ type: 1, status: 1 });
ProfileSchema.index({ lastUsedAt: -1 });

// Middleware para validaciones específicas
ProfileSchema.pre('save', function (next) {
  // Actualizar lastUsedAt al modificar
  this.lastUsedAt = new Date();

  // Validaciones específicas por tipo
  switch (this.type) {
    case ProfileType.PERSONAL:
      if (!this.name.includes('Personal')) {
        this.name = `${this.name} Personal`;
      }
      break;

    case ProfileType.COUPLE:
      // Validar que no tenga más de 1 miembro adicional
      if (this.members.length > 1) {
        return next(new Error('Couple profile cannot have more than 1 additional member'));
      }
      break;

    case ProfileType.FAMILY:
      // Configurar límites por defecto para niños
      if (!this.settings.privacy?.childTransactionLimit) {
        this.settings.privacy = this.settings.privacy || {};
        this.settings.privacy.childTransactionLimit = 50;
      }
      break;

    case ProfileType.BUSINESS:
      // Configurar aprobaciones por defecto
      if (!this.settings.privacy?.approvalThreshold) {
        this.settings.privacy = this.settings.privacy || {};
        this.settings.privacy.requireApproval = true;
        this.settings.privacy.approvalThreshold = 500;
      }
      break;
  }

  next();
});

// Métodos virtuales
ProfileSchema.virtual('totalMembers').get(function () {
  return this.members.length + 1; // +1 por el owner
});

ProfileSchema.virtual('isPersonal').get(function () {
  return this.type === ProfileType.PERSONAL;
});

ProfileSchema.virtual('isShared').get(function () {
  return [ProfileType.COUPLE, ProfileType.FAMILY, ProfileType.BUSINESS].includes(this.type);
});

// Timestamps are handled by mongoose with timestamps: true option in @Schema decorator

// Base schema
export * from './base-profile.schema';

// Specialized profile schemas
export * from './business-profile.schema';
export * from './couple-profile.schema';
export * from './family-profile.schema';
export * from './personal-profile.schema';

// Profile type enum for consistency
export enum ProfileType {
  PERSONAL = 'personal',
  COUPLE = 'couple',
  FAMILY = 'family',
  BUSINESS = 'business'
}

export type AnyProfileDocument = PersonalProfileDocument | CoupleProfileDocument | FamilyProfileDocument | CompanyProfileDocument;

// Helper type to get profile document type from profile type
export type ProfileDocumentType<T extends ProfileType> = T extends ProfileType.PERSONAL ? import('./personal-profile.schema').PersonalProfileDocument
  : T extends ProfileType.COUPLE ? import('./couple-profile.schema').CoupleProfileDocument
  : T extends ProfileType.FAMILY ? import('./family-profile.schema').FamilyProfileDocument
  : T extends ProfileType.BUSINESS ? import('./business-profile.schema').CompanyProfileDocument
  : never;

// Schema mappings for static access
import { CompanyProfileDocument, CompanyProfileSchema } from './business-profile.schema';
import { CoupleProfileDocument, CoupleProfileSchema } from './couple-profile.schema';
import { FamilyProfileDocument, FamilyProfileSchema } from './family-profile.schema';
import { PersonalProfileDocument, PersonalProfileSchema } from './personal-profile.schema';

export const PROFILE_SCHEMAS = {
  [ProfileType.PERSONAL]: {
    name: ProfileType.PERSONAL,
    schema: PersonalProfileSchema,
    collection: 'personalprofiles'
  },
  [ProfileType.COUPLE]: {
    name: ProfileType.COUPLE,
    schema: CoupleProfileSchema,
    collection: 'coupleprofiles'
  },
  [ProfileType.FAMILY]: {
    name: ProfileType.FAMILY,
    schema: FamilyProfileSchema,
    collection: 'familyprofiles'
  },
  [ProfileType.BUSINESS]: {
    name: ProfileType.BUSINESS,
    schema: CompanyProfileSchema,
    collection: 'businessprofiles'
  }
} as const;

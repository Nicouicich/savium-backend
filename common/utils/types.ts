import { PersonalProfileDocument, CoupleProfileDocument, FamilyProfileDocument, CompanyProfileDocument, BaseProfile, ProfileType } from "src/financial-profiles/schemas";

export function getTypedProfile(userActiveProfileType: string, activeProfile: any) {

  switch (userActiveProfileType) {
    case 'PersonalProfile':
      return activeProfile as PersonalProfileDocument;
    case 'CoupleProfile':
      return activeProfile as CoupleProfileDocument;
    case 'FamilyProfile':
      return activeProfile as FamilyProfileDocument;
    case 'CompanyProfile':
      return activeProfile as CompanyProfileDocument;
    default:
      return activeProfile as BaseProfile;

  }
}

export function getProfileType(message: string | undefined): ProfileType | undefined {
  if (!message) return undefined;

  // Cortamos lo que está después de '@'
  const afterAt = message.split('@')[1];
  if (!afterAt) return undefined;

  // Convertimos a mayúscula
  const key = afterAt.toUpperCase();

  switch (key) {
    case "PERSONAL":
      return ProfileType.PERSONAL;
    case "PAREJA":
      return ProfileType.COUPLE;
    case "FAMILY":
      return ProfileType.FAMILY;
    case "BUSINESS":
      return ProfileType.BUSINESS;
    default:
      return undefined; // opcional, en caso que no coincida
  }
}
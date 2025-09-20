import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateProfileDto } from './create-profile.dto';

export class UpdateProfileDto extends PartialType(OmitType(CreateProfileDto, ['type'] as const)) {
  // El tipo no se puede cambiar después de creado
}

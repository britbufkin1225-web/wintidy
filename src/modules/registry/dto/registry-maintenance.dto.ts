import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { RegistryStartupKey } from '../registry-key';

export class RegistryTargetDto {
  @IsEnum(RegistryStartupKey)
  key: RegistryStartupKey;

  @IsString()
  @IsNotEmpty()
  @MaxLength(16_383)
  valueName: string;
}

export class RegistryPreviewDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique(
    (target: RegistryTargetDto) => `${target.key}:${target.valueName}`,
  )
  @ValidateNested({ each: true })
  @Type(() => RegistryTargetDto)
  targets: RegistryTargetDto[];
}

export class RegistryRunDto extends RegistryPreviewDto {
  @IsBoolean()
  @Equals(true, { message: 'confirm must be true to remove registry entries' })
  confirm: true;
}

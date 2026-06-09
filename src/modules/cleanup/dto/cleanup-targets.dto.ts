import {
  ArrayNotEmpty,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { CleanupCategory } from '../cleanup-category';

export class CleanupTargetsDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsEnum(CleanupCategory, { each: true })
  categories: CleanupCategory[];
}

export class RunCleanupDto extends CleanupTargetsDto {
  @IsBoolean()
  @Equals(true, { message: 'confirm must be true to run cleanup' })
  confirm: true;
}

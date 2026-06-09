import { IsNotEmpty, IsString } from 'class-validator';

export class DuplicateQueryDto {
  @IsString()
  @IsNotEmpty()
  path: string;
}

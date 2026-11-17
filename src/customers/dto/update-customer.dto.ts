import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

// A PATCH can provide one or more properties; no role or password can be modified here.
export class UpdateCustomerDto {
  @ApiPropertyOptional({ example: 'Ahmed Ali' })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  full_name?: string;

  @ApiPropertyOptional({ example: 'ahmed.new@example.com' })
  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '01099999999', nullable: true })
  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ example: true })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  is_active?: boolean;
}

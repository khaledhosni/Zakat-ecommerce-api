
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  MaxLength,
  Matches,
} from 'class-validator';

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProductDto {

  @ApiProperty({ example: 'Laptop' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  product_name!: string;

  @ApiPropertyOptional({ example: '15-inch laptop' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    example: '25000.00',
    description: 'Positive decimal string, maximum 2 decimal places',
  })
  @IsString()
  @Matches(/^(?=.*[1-9])[0-9]{1,10}(\.[0-9]{1,2})?$/, {
    message: 'Price must be positive with up to 2 decimal places',
  })
  price!: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

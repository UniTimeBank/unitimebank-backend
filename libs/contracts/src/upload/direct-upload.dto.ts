import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const DIRECT_UPLOAD_PURPOSES = [
  'AVATAR',
  'CHAT_ATTACHMENT',
  'REPORT_EVIDENCE',
] as const;
export type DirectUploadPurpose = (typeof DIRECT_UPLOAD_PURPOSES)[number];

export class CreateDirectUploadSignatureDto {
  @ApiProperty({ enum: DIRECT_UPLOAD_PURPOSES })
  @IsIn(DIRECT_UPLOAD_PURPOSES)
  purpose: DirectUploadPurpose;

  @ApiPropertyOptional({ description: 'Bắt buộc với CHAT_ATTACHMENT' })
  @IsOptional()
  @IsString()
  bookingId?: string;

  @ApiProperty({ example: 'avatar.png' })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @ApiProperty({ example: 'image/png' })
  @IsNotEmpty()
  @IsString()
  mimeType: string;

  @ApiProperty({ example: 102400 })
  @IsInt()
  @Min(1)
  @Max(100 * 1024 * 1024)
  fileSize: number;
}

export class ConfirmDirectAssetDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  publicId: string;

  @ApiProperty({ enum: ['image', 'raw', 'video'] })
  @IsIn(['image', 'raw', 'video'])
  resourceType: 'image' | 'raw' | 'video';
}

export class ConfirmAvatarUploadDto extends ConfirmDirectAssetDto {}

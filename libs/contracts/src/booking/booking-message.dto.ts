import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class SendBookingMessageDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Chào bạn, mình muốn hỏi về tài liệu buổi học sắp tới.',
  })
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi' })
  content: string;

  @ApiPropertyOptional({
    description: 'Loại tin nhắn: TEXT, IMAGE, FILE, LINK, SYSTEM',
    example: 'TEXT',
    default: 'TEXT',
  })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn tệp đính kèm (nếu có)',
    example: 'https://res.cloudinary.com/demo/image/upload/sample.png',
  })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({
    description: 'Tên gốc của tệp đính kèm',
    example: 'De_cuong_OOP.pdf',
  })
  @IsOptional()
  @IsString()
  attachmentName?: string;

  @ApiPropertyOptional({
    description: 'Dung lượng tệp (bytes)',
    example: 1048576,
  })
  @IsOptional()
  attachmentSize?: number;

  @ApiPropertyOptional({
    description: 'MIME type của tệp',
    example: 'application/pdf',
  })
  @IsOptional()
  @IsString()
  attachmentMime?: string;

  @ApiPropertyOptional({ description: 'Cloudinary public_id dùng để xác minh direct upload' })
  @IsOptional()
  @IsString()
  attachmentPublicId?: string;

  @ApiPropertyOptional({ description: 'Cloudinary resource_type của asset' })
  @IsOptional()
  @IsIn(['image', 'raw', 'video'])
  attachmentResourceType?: 'image' | 'raw' | 'video';
}

export class BookingMessageResponseDto {
  @ApiProperty({ description: 'ID tin nhắn' })
  id: string;

  @ApiProperty({ description: 'ID buổi học liên kết' })
  bookingId: string;

  @ApiProperty({ description: 'ID người gửi' })
  senderId: string;

  @ApiPropertyOptional({ description: 'Tên người gửi' })
  senderName?: string;

  @ApiPropertyOptional({ description: 'Avatar người gửi' })
  senderAvatar?: string;

  @ApiProperty({ description: 'Loại tin nhắn: TEXT, IMAGE, FILE, LINK, SYSTEM', default: 'TEXT' })
  type: string;

  @ApiProperty({ description: 'Nội dung tin nhắn' })
  content: string;

  @ApiPropertyOptional({ description: 'URL tệp đính kèm' })
  attachmentUrl?: string;

  @ApiPropertyOptional({ description: 'Tên gốc tệp đính kèm' })
  attachmentName?: string;

  @ApiPropertyOptional({ description: 'Dung lượng tệp (bytes)' })
  attachmentSize?: number;

  @ApiPropertyOptional({ description: 'MIME type của tệp' })
  attachmentMime?: string;

  @ApiProperty({ description: 'Thời gian gửi' })
  sentAt: Date;

  @ApiPropertyOptional({ description: 'Thời gian đối phương đã đọc' })
  readAt?: Date;
}

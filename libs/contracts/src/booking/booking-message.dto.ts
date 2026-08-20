import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class SendBookingMessageDto {
  @ApiProperty({
    description: 'Nội dung tin nhắn',
    example: 'Chào bạn, mình muốn hỏi về tài liệu buổi học sắp tới.',
  })
  @IsNotEmpty({ message: 'Nội dung tin nhắn không được để trống' })
  @IsString({ message: 'Nội dung tin nhắn phải là chuỗi' })
  content: string;

  @ApiPropertyOptional({
    description: 'Đường dẫn tệp đính kèm (nếu có)',
    example: 'https://res.cloudinary.com/demo/image/upload/sample.png',
  })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;
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

  @ApiProperty({ description: 'Nội dung tin nhắn' })
  content: string;

  @ApiPropertyOptional({ description: 'Đường dẫn tệp đính kèm' })
  attachmentUrl?: string;

  @ApiProperty({ description: 'Thời gian gửi' })
  sentAt: Date;

  @ApiPropertyOptional({ description: 'Thời gian đọc' })
  readAt?: Date;
}

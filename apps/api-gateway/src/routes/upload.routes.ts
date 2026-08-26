import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { JwtAuthGuard, CloudinaryService } from '@app/common';
import { CreateDirectUploadSignatureDto } from '@app/contracts';
import { BookingClient } from '../clients/booking.client';

const AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const EVIDENCE_MIME_TYPES = [
  ...AVATAR_MIME_TYPES,
  'video/mp4',
  'video/webm',
  'video/quicktime',
];
const FORBIDDEN_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.vbs',
  '.apk',
  '.msi',
  '.scr',
  '.pif',
];

interface AuthenticatedRequest {
  user: { id: string };
  headers: { authorization: string };
}

@ApiTags('Upload - Signed direct upload')
@Controller('uploads')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadRoutes {
  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly bookingClient: BookingClient,
  ) {}

  @Post('signature')
  @ApiOperation({
    summary: 'Cấp chữ ký ngắn hạn để frontend upload trực tiếp lên Cloudinary',
  })
  async createSignature(
    @Body() dto: CreateDirectUploadSignatureDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const userId = req.user.id;

    if (dto.purpose === 'AVATAR') {
      this.assertFile(dto, 5 * 1024 * 1024, AVATAR_MIME_TYPES);
      return this.cloudinaryService.createDirectUploadSignature({
        folder: 'unitimebank/avatars',
        publicId: `avatar_${userId}`,
        resourceType: 'image',
        overwrite: true,
        maxBytes: 5 * 1024 * 1024,
        allowedMimeTypes: AVATAR_MIME_TYPES,
      });
    }

    if (dto.purpose === 'CHAT_ATTACHMENT') {
      if (!dto.bookingId)
        throw new BadRequestException('CHAT_ATTACHMENT yêu cầu bookingId');
      this.assertSafeExtension(dto.fileName);
      this.assertFile(dto, 10 * 1024 * 1024);
      await this.bookingClient.getBookingMessages(dto.bookingId, {
        Authorization: req.headers.authorization,
      });

      const isImage = dto.mimeType.startsWith('image/');
      const extension = this.safeExtension(dto.fileName);
      const publicId = `${userId}_${randomUUID()}${isImage ? '' : extension}`;
      return this.cloudinaryService.createDirectUploadSignature({
        folder: `unitimebank/chat-attachments/${dto.bookingId}`,
        publicId,
        resourceType: isImage ? 'image' : 'raw',
        overwrite: false,
        maxBytes: 10 * 1024 * 1024,
        allowedMimeTypes: [dto.mimeType],
      });
    }

    this.assertFile(dto, 100 * 1024 * 1024, EVIDENCE_MIME_TYPES);
    const isVideo = dto.mimeType.startsWith('video/');
    return this.cloudinaryService.createDirectUploadSignature({
      folder: `unitimebank/report-evidence/${userId}`,
      publicId: randomUUID(),
      resourceType: isVideo ? 'video' : 'image',
      overwrite: false,
      maxBytes: 100 * 1024 * 1024,
      allowedMimeTypes: EVIDENCE_MIME_TYPES,
    });
  }

  private assertFile(
    dto: CreateDirectUploadSignatureDto,
    maxBytes: number,
    allowedMimeTypes?: string[],
  ) {
    if (dto.fileSize > maxBytes) {
      throw new BadRequestException(
        `File vượt quá giới hạn ${Math.round(maxBytes / 1024 / 1024)}MB`,
      );
    }
    if (allowedMimeTypes && !allowedMimeTypes.includes(dto.mimeType)) {
      throw new BadRequestException('Định dạng file không được phép');
    }
  }

  private assertSafeExtension(fileName: string) {
    const lowerName = fileName.toLowerCase();
    if (
      FORBIDDEN_EXTENSIONS.some((extension) => lowerName.endsWith(extension))
    ) {
      throw new BadRequestException(
        'Định dạng file không được phép vì lý do bảo mật',
      );
    }
  }

  private safeExtension(fileName: string) {
    const match = fileName.toLowerCase().match(/\.[a-z0-9]{1,10}$/);
    return match?.[0] || '';
  }
}

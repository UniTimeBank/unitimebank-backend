import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  v2 as cloudinary,
  UploadApiOptions,
  UploadApiResponse,
} from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly cloudName?: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;

  constructor(private readonly configService: ConfigService) {
    this.cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    this.apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    this.apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (this.cloudName && this.apiKey && this.apiSecret) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
      });
      this.logger.log('Cloudinary successfully configured');
    } else {
      this.logger.warn(
        'Cloudinary environment variables missing. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
      );
    }
  }

  createDirectUploadSignature(options: {
    folder: string;
    publicId: string;
    resourceType: 'image' | 'raw' | 'video';
    overwrite?: boolean;
    maxBytes: number;
    allowedMimeTypes: string[];
  }) {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      throw new BadRequestException('Cloudinary chưa được cấu hình đầy đủ');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const uploadParams: Record<string, string | number | boolean> = {
      timestamp,
      folder: options.folder,
      public_id: options.publicId,
    };
    if (options.overwrite !== undefined)
      uploadParams.overwrite = options.overwrite;

    const signature = cloudinary.utils.api_sign_request(
      uploadParams,
      this.apiSecret,
    );

    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      signature,
      timestamp,
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/${options.resourceType}/upload`,
      uploadParams,
      resourceType: options.resourceType,
      publicId: `${options.folder}/${options.publicId}`,
      expiresAt: (timestamp + 5 * 60) * 1000,
      constraints: {
        maxBytes: options.maxBytes,
        allowedMimeTypes: options.allowedMimeTypes,
      },
    };
  }

  async verifyDirectUpload(options: {
    publicId: string;
    resourceType: 'image' | 'raw' | 'video';
    expectedPublicIdPrefix: string;
    maxBytes: number;
    allowedFormats?: string[];
  }): Promise<{
    url: string;
    publicId: string;
    bytes: number;
    format?: string;
    resourceType: string;
  }> {
    if (!options.publicId.startsWith(options.expectedPublicIdPrefix)) {
      throw new BadRequestException(
        'Asset không thuộc phạm vi upload được cấp quyền',
      );
    }

    let asset: UploadApiResponse;
    try {
      asset = (await cloudinary.api.resource(options.publicId, {
        resource_type: options.resourceType,
        type: 'upload',
      })) as UploadApiResponse;
    } catch (error) {
      this.logger.warn(
        `Cannot verify direct upload ${options.publicId}`,
        error,
      );
      throw new BadRequestException(
        'Không tìm thấy asset vừa tải lên Cloudinary',
      );
    }

    if (!asset?.secure_url || typeof asset.bytes !== 'number') {
      throw new BadRequestException('Thông tin asset Cloudinary không hợp lệ');
    }
    if (asset.bytes > options.maxBytes) {
      await this.deleteAsset(options.publicId, options.resourceType);
      throw new BadRequestException('Asset vượt quá dung lượng cho phép');
    }

    const format =
      typeof asset.format === 'string' ? asset.format.toLowerCase() : undefined;
    if (
      options.allowedFormats?.length &&
      (!format || !options.allowedFormats.includes(format))
    ) {
      await this.deleteAsset(options.publicId, options.resourceType);
      throw new BadRequestException(
        'Định dạng asset Cloudinary không được phép',
      );
    }

    return {
      url: asset.secure_url,
      publicId: asset.public_id,
      bytes: asset.bytes,
      format,
      resourceType: asset.resource_type,
    };
  }

  async deleteAsset(
    publicId: string,
    resourceType: 'image' | 'raw' | 'video' = 'image',
  ): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
    } catch (err) {
      this.logger.error(`Error deleting Cloudinary asset (${publicId}):`, err);
    }
  }

  /**
   * Upload Buffer ảnh lên Cloudinary
   */
  async uploadImage(
    fileBuffer: Buffer,
    folder = 'unitimebank/avatars',
    publicId?: string,
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          overwrite: true,
          resource_type: 'image',
          transformation: [
            { width: 500, height: 500, crop: 'limit' },
            { quality: 'auto' },
            { fetch_format: 'auto' },
          ],
        },
        (error, result: UploadApiResponse) => {
          if (error) {
            this.logger.error('Error uploading image to Cloudinary:', error);
            return reject(
              new BadRequestException('Lỗi tải ảnh lên đám mây Cloudinary'),
            );
          }
          resolve({
            url: result.secure_url || result.url,
            publicId: result.public_id,
          });
        },
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Upload tệp đính kèm / hình ảnh / tài liệu phòng chat lên Cloudinary
   */
  async uploadAttachment(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    folder = 'unitimebank/chat-attachments',
  ): Promise<{ url: string; publicId: string; size?: number }> {
    const isImage = mimeType.startsWith('image/');
    const cleanFileName = originalName
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_');
    const publicId = `${Date.now()}_${cleanFileName}`;

    return new Promise((resolve, reject) => {
      const uploadOptions: UploadApiOptions = {
        folder,
        public_id: publicId,
        resource_type: isImage ? 'image' : 'raw',
      };

      if (isImage) {
        uploadOptions.transformation = [
          { quality: 'auto' },
          { fetch_format: 'auto' },
        ];
      }

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result: UploadApiResponse) => {
          if (error) {
            this.logger.error(
              'Error uploading chat attachment to Cloudinary:',
              error,
            );
            return reject(
              new BadRequestException('Lỗi tải tệp tin lên đám mây Cloudinary'),
            );
          }
          resolve({
            url: result.secure_url || result.url,
            publicId: result.public_id,
            size: result.bytes,
          });
        },
      );

      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Xóa ảnh khỏi Cloudinary theo publicId
   */
  async deleteImage(publicId: string): Promise<void> {
    return this.deleteAsset(publicId, 'image');
  }
}

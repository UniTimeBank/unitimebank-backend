import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  constructor(private readonly configService: ConfigService) {
    const cloudName = this.configService.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.configService.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.configService.get<string>('CLOUDINARY_API_SECRET');

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.logger.log('Cloudinary successfully configured');
    } else {
      this.logger.warn(
        'Cloudinary environment variables missing. Please configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env',
      );
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
   * Xóa ảnh khỏi Cloudinary theo publicId
   */
  async deleteImage(publicId: string): Promise<void> {
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      this.logger.error(`Error deleting Cloudinary image (${publicId}):`, err);
    }
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

export class CreateRatingDto {
  @ApiProperty({ description: 'ID của booking cần đánh giá' })
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @ApiPropertyOptional({ description: 'ID của session (nếu có)' })
  @IsOptional()
  @IsString()
  sessionId?: string;

  @ApiProperty({ description: 'ID của người dạy (Mentor)' })
  @IsNotEmpty()
  @IsString()
  mentorId: string;

  @ApiPropertyOptional({ description: 'ID của học viên (Learner)' })
  @IsOptional()
  @IsString()
  learnerId?: string;

  @ApiProperty({ description: 'Số sao đánh giá từ 1 đến 5', minimum: 1, maximum: 5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  stars: number;

  @ApiPropertyOptional({ description: 'Nhận xét chi tiết về buổi học' })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiPropertyOptional({ description: 'Tên người đánh giá' })
  @IsOptional()
  @IsString()
  reviewerName?: string;

  @ApiPropertyOptional({ description: 'Ảnh đại diện người đánh giá' })
  @IsOptional()
  @IsString()
  reviewerAvatar?: string;
}

export class RatingResponseDto {
  id: string;
  bookingId: string;
  sessionId?: string;
  learnerId: string;
  mentorId: string;
  stars: number;
  comment?: string;
  submittedAt: Date;
  reviewerName?: string;
  reviewerAvatar?: string;
}

export class UserReviewsSummaryDto {
  userId: string;
  averageRating: number;
  totalReviews: number;
  starDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  reviews: RatingResponseDto[];
}

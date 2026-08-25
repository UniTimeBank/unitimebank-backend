import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsArray, IsNumber } from 'class-validator';

export class EvidenceItemDto {
  @ApiProperty({ description: 'URL của file bằng chứng' })
  @IsNotEmpty()
  @IsString()
  url: string;

  @ApiProperty({ description: 'Loại bằng chứng: IMAGE hoặc VIDEO' })
  @IsNotEmpty()
  @IsString()
  kind: string;

  @ApiPropertyOptional({ description: 'Metadata bổ sung' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateViolationReportDto {
  @ApiProperty({ description: 'ID của người dùng bị báo cáo' })
  @IsNotEmpty()
  @IsString()
  targetUserId: string;

  @ApiPropertyOptional({ description: 'Loại đối tượng bị báo cáo (USER, BOOKING, POST)', default: 'USER' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ description: 'ID của đối tượng bị báo cáo (bookingId, postId, v.v.)' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiProperty({ description: 'Danh mục vi phạm: AFK_ABUSE, TOXIC_LANGUAGE, FRAUD, INAPPROPRIATE_CONTENT, SPAM, OTHER' })
  @IsNotEmpty()
  @IsString()
  category: string;

  @ApiPropertyOptional({ description: 'Mô tả chi tiết vi phạm' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Danh sách URL bằng chứng', type: [EvidenceItemDto] })
  @IsOptional()
  @IsArray()
  evidenceUrls?: EvidenceItemDto[];
}

export class ResolveReportDto {
  @ApiPropertyOptional({ description: 'ID báo cáo vi phạm' })
  @IsOptional()
  @IsString()
  reportId?: string;

  @ApiProperty({ description: 'Quyết định xử lý: NO_ACTION, WARN, REMOVE_CONTENT, DEDUCT_TRUST, LOCK_ACCOUNT' })
  @IsNotEmpty()
  @IsString()
  decisionType: string;

  @ApiPropertyOptional({ description: 'Loại hình phạt' })
  @IsOptional()
  @IsString()
  actionType?: string;

  @ApiPropertyOptional({ description: 'Ghi chú của người xử lý' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Số điểm uy tín bị trừ (nếu có)' })
  @IsOptional()
  @IsNumber()
  trustScorePenalty?: number;
}

export class ViolationReportResponseDto {
  id: string;
  reporterId: string;
  targetUserId: string;
  targetType: string;
  targetId: string;
  category: string;
  description?: string;
  status: string;
  submittedAt: Date;
  closedAt?: Date;
  evidences?: Array<{
    id: string;
    url: string;
    kind: string;
  }>;
}

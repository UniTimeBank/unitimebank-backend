import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SkillDto } from '../skill';


export class GetUserProfileResponseDto {
  @ApiProperty({ example: 'uuid-string', description: 'ID profile' })
  id: string;

  @ApiProperty({ example: 'uuid-string', description: 'ID user từ Auth' })
  userId: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên hiển thị' })
  displayName: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/xxx/avatar.jpg',
    description: 'URL avatar',
  })
  avatarUrl: string | null;

  @ApiPropertyOptional({
    example: 'Sinh viên CNTT',
    description: 'Tiểu sử',
  })
  bio: string | null;

  @ApiProperty({ example: 100, description: 'Điểm uy tín (0-100)' })
  trustScore: number;

  @ApiProperty({ example: false, description: 'Đã hoàn thành onboarding' })
  onboardingCompleted: boolean;

  @ApiPropertyOptional({ type: [SkillDto], description: 'Danh sách kỹ năng của người dùng' })
  skills?: SkillDto[];

  @ApiProperty({ example: '2024-01-01T00:00:00Z', description: 'Thời điểm tạo' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-15T12:00:00Z', description: 'Thời điểm cập nhật' })
  updatedAt: Date;
}

export class GetPublicProfileResponseDto {
  @ApiProperty({ example: 'uuid-string', description: 'ID profile' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên hiển thị' })
  displayName: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/xxx/avatar.jpg',
    description: 'URL avatar',
  })
  avatarUrl: string | null;

  @ApiPropertyOptional({
    example: 'Sinh viên CNTT',
    description: 'Tiểu sử',
  })
  bio: string | null;

  @ApiProperty({ example: 85, description: 'Điểm uy tín (0-100)' })
  trustScore: number;

  @ApiProperty({
    example: 'GOOD',
    description: 'Xếp hạng: EXCELLENT, GOOD, AVERAGE, WARNING, LOCKED',
    enum: ['EXCELLENT', 'GOOD', 'AVERAGE', 'WARNING', 'LOCKED'],
  })
  trustTier: string;

  @ApiPropertyOptional({ type: [SkillDto], description: 'Danh sách kỹ năng công khai của người dùng' })
  skills?: SkillDto[];
}

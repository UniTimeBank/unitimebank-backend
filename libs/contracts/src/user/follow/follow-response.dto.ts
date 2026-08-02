import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FollowUserResponseDto {
  @ApiProperty({ example: 'Followed successfully', description: 'Thông báo kết quả' })
  message: string;

  @ApiProperty({ example: 'uuid-string', description: 'ID người dùng được theo dõi' })
  followeeId: string;
}

export class FollowUserSummaryDto {
  @ApiProperty({ example: 'uuid-string', description: 'ID user' })
  id: string;

  @ApiProperty({ example: 'Nguyễn Văn A', description: 'Tên hiển thị' })
  displayName: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/xxx/avatar.jpg',
    description: 'URL ảnh đại diện',
  })
  avatarUrl: string | null;

  @ApiProperty({ example: 90, description: 'Điểm uy tín (0-100)' })
  trustScore: number;
}

export class GetFollowersResponseDto {
  @ApiProperty({ type: [FollowUserSummaryDto], description: 'Danh sách người theo dõi' })
  followers: FollowUserSummaryDto[];

  @ApiProperty({ example: 25, description: 'Tổng số người theo dõi' })
  total: number;
}

export class GetFollowingResponseDto {
  @ApiProperty({ type: [FollowUserSummaryDto], description: 'Danh sách người đang theo dõi' })
  following: FollowUserSummaryDto[];

  @ApiProperty({ example: 10, description: 'Tổng số người đang theo dõi' })
  total: number;
}

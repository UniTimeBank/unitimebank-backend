import { IsString, IsNotEmpty, IsOptional, IsArray, IsEnum, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommunityGroupDto {
  @ApiProperty({ description: 'Tên nhóm học tập', example: 'Cộng đồng Lập trình Frontend' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Mô tả chi tiết nhóm', example: 'Nơi trao đổi kinh nghiệm, giải đáp thắc mắc...' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Ảnh bìa nhóm', example: 'https://...' })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Avatar nhóm', example: 'https://...' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({ description: 'Chuyên ngành / Danh mục', example: 'Công nghệ thông tin' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ description: 'Quy tắc nhóm', example: ['Không spam', 'Tôn trọng nhau'] })
  @IsArray()
  @IsOptional()
  rules?: string[];
}

export class CreateGroupPostDto {
  @ApiProperty({ description: 'Nội dung bài viết', example: 'Có bạn nào rảnh cùng giải bài tập Giải Tích 2 không?' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Danh sách ảnh đính kèm', example: ['https://...'] })
  @IsArray()
  @IsOptional()
  images?: string[];

  @ApiPropertyOptional({ description: 'Tag bài viết', example: 'QA', enum: ['QA', 'DOCUMENT', 'STUDY_BUDDY', 'GENERAL'] })
  @IsString()
  @IsOptional()
  tag?: string;
}

export class CreateGroupCommentDto {
  @ApiProperty({ description: 'Nội dung bình luận', example: 'Mình có file lời giải nè, ib mình nhé!' })
  @IsString()
  @IsNotEmpty()
  content: string;
}

export interface CommunityGroupResponseDto {
  _id: string;
  name: string;
  description: string;
  coverImage: string;
  avatarUrl: string;
  category: string;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  membersCount: number;
  postsCount: number;
  rules: string[];
  isJoined?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupPostResponseDto {
  _id: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorHeadline?: string;
  content: string;
  images: string[];
  tag: string;
  likesCount: number;
  isLiked?: boolean;
  commentsCount: number;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupCommentResponseDto {
  _id: string;
  postId: string;
  groupId: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}

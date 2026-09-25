import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateCommunityGroupDto {
  @ApiProperty({ description: 'Tên nhóm học tập', example: 'Nhóm Lập Trình TypeScript' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Mô tả mục tiêu của nhóm' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: 'Ảnh bìa nhóm' })
  @IsString()
  @IsOptional()
  coverImage?: string;

  @ApiPropertyOptional({ description: 'Ảnh bìa nhóm (alias)' })
  @IsString()
  @IsOptional()
  coverUrl?: string;

  @ApiPropertyOptional({ description: 'Avatar nhóm' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiProperty({ description: 'Danh mục nhóm' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiPropertyOptional({ description: 'Nội quy nhóm', type: [String] })
  @IsOptional()
  rules?: string[];

  @ApiPropertyOptional({ description: 'Nhóm công khai' })
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}

export class CreateGroupPostDto {
  @ApiProperty({ description: 'Nội dung bài viết', example: 'Có bạn nào cần giải bài tập Giải tích 1 không?' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Danh sách URL ảnh đính kèm', example: ['https://res.cloudinary.com/...'] })
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

  @ApiPropertyOptional({ description: 'ID của bình luận cha nếu là câu trả lời (cấp 2)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ description: 'Tên người dùng được trả lời' })
  @IsOptional()
  @IsString()
  replyToUserName?: string;
}

export class TransferGroupOwnershipDto {
  @ApiProperty({ description: 'ID của thành viên mới được chuyển quyền trưởng nhóm' })
  @IsString()
  @IsNotEmpty()
  newOwnerId: string;
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
  memberIds?: string[];
  bannedUserIds?: string[];
  membersCount: number;
  postsCount: number;
  rules: string[];
  isJoined?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GroupMemberDto {
  id: string;
  name: string;
  avatar: string;
  email?: string;
  role: 'CREATOR' | 'MEMBER';
}

export interface BannedMemberDto {
  id: string;
  name: string;
  avatar: string;
  email?: string;
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
  parentId?: string;
  replyToUserName?: string;
  authorId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  createdAt: string;
}


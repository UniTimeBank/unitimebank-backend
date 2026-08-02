import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FollowRelation } from '../entities/follow-relation.entity';
import { UserProfile } from '../entities/user-profile.entity';
import {
  FollowUserResponseDto,
  GetFollowersResponseDto,
  GetFollowingResponseDto,
  FollowUserSummaryDto,
} from '@app/contracts/user';

@Injectable()
export class UserFollowService {
  constructor(
    @InjectRepository(FollowRelation)
    private readonly followRepo: Repository<FollowRelation>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
  ) {}

  /**
   * Theo dõi một người dùng khác
   */
  async followUser(
    followerId: string,
    targetUserId: string,
  ): Promise<FollowUserResponseDto> {
    if (followerId === targetUserId) {
      throw new BadRequestException('Bạn không thể tự theo dõi chính mình');
    }

    const targetProfile = await this.userProfileRepo.findOne({
      where: { userId: targetUserId },
    });

    if (!targetProfile) {
      throw new NotFoundException('Không tìm thấy người dùng cần theo dõi');
    }

    const existing = await this.followRepo.findOne({
      where: { followerId, followeeId: targetUserId },
    });

    if (existing) {
      throw new ConflictException('Bạn đã theo dõi người dùng này rồi');
    }

    const relation = this.followRepo.create({
      followerId,
      followeeId: targetUserId,
    });

    await this.followRepo.save(relation);

    return {
      message: 'Theo dõi thành công',
      followeeId: targetUserId,
    };
  }

  /**
   * Bỏ theo dõi một người dùng
   */
  async unfollowUser(
    followerId: string,
    targetUserId: string,
  ): Promise<{ message: string }> {
    const relation = await this.followRepo.findOne({
      where: { followerId, followeeId: targetUserId },
    });

    if (!relation) {
      throw new NotFoundException('Bạn chưa theo dõi người dùng này');
    }

    await this.followRepo.remove(relation);

    return { message: 'Bỏ theo dõi thành công' };
  }

  /**
   * Lấy danh sách những người theo dõi một user (Followers)
   */
  async getFollowers(targetUserId: string): Promise<GetFollowersResponseDto> {
    const targetProfile = await this.userProfileRepo.findOne({
      where: { userId: targetUserId },
    });

    if (!targetProfile) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const [relations, total] = await this.followRepo.findAndCount({
      where: { followeeId: targetUserId },
      relations: { follower: true },
      order: { createdAt: 'DESC' },
    });

    const followers: FollowUserSummaryDto[] = relations.map((rel) => {
      const p = rel.follower;
      return {
        id: p ? p.userId : rel.followerId,
        displayName: p ? p.displayName : '',
        avatarUrl: p ? p.avatarUrl : null,
        trustScore: p ? p.trustScore : 100,
      };
    });

    return {
      followers,
      total,
    };
  }

  /**
   * Lấy danh sách những người mà user đang theo dõi (Following)
   */
  async getFollowing(targetUserId: string): Promise<GetFollowingResponseDto> {
    const targetProfile = await this.userProfileRepo.findOne({
      where: { userId: targetUserId },
    });

    if (!targetProfile) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const [relations, total] = await this.followRepo.findAndCount({
      where: { followerId: targetUserId },
      relations: { followee: true },
      order: { createdAt: 'DESC' },
    });

    const following: FollowUserSummaryDto[] = relations.map((rel) => {
      const p = rel.followee;
      return {
        id: p ? p.userId : rel.followeeId,
        displayName: p ? p.displayName : '',
        avatarUrl: p ? p.avatarUrl : null,
        trustScore: p ? p.trustScore : 100,
      };
    });

    return {
      following,
      total,
    };
  }

  /**
   * Kiểm tra xem user A có đang theo dõi user B không
   */
  async checkIsFollowing(followerId: string, targetUserId: string): Promise<boolean> {
    const existing = await this.followRepo.findOne({
      where: { followerId, followeeId: targetUserId },
    });

    return !!existing;
  }
}

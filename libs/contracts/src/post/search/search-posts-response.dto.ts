import { ApiProperty } from '@nestjs/swagger';
import { MentorPostResponseDto } from '../mentor-post';
import { LearnerRequestResponseDto } from '../learner-request';

export class SearchPostsResponseDto {
  @ApiProperty({ type: [MentorPostResponseDto], description: 'Danh sách bài đăng của Mentor khớp kết quả' })
  mentorPosts: MentorPostResponseDto[];

  @ApiProperty({ type: [LearnerRequestResponseDto], description: 'Danh sách yêu cầu của Learner khớp kết quả' })
  learnerRequests: LearnerRequestResponseDto[];

  @ApiProperty({ example: 40, description: 'Tổng số bài kết quả' })
  total: number;

  @ApiProperty({ example: 1, description: 'Trang hiện tại' })
  page: number;

  @ApiProperty({ example: 12, description: 'Số lượng bài mỗi trang' })
  limit: number;
}

export class PostRecommendationsResponseDto {
  @ApiProperty({ type: [MentorPostResponseDto], description: 'Danh sách bài dạy gợi ý phù hợp cho bạn' })
  recommendedMentorPosts: MentorPostResponseDto[];

  @ApiProperty({ type: [LearnerRequestResponseDto], description: 'Danh sách yêu cầu tìm bạn học cùng gợi ý' })
  recommendedLearnerRequests: LearnerRequestResponseDto[];
}

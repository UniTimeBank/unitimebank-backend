import { ApiProperty } from '@nestjs/swagger';

export class PostSuggestionsResponseDto {
  @ApiProperty({
    example: ['Spring Boot', 'Spring Cloud', 'Spring Security'],
    description: 'Danh sách từ khóa kỹ năng gợi ý',
  })
  skills: string[];

  @ApiProperty({
    example: ['Hướng dẫn Spring Boot Microservices từ cơ bản', 'Lập trình Spring Boot REST API'],
    description: 'Danh sách tiêu đề bài dạy nổi bật gợi ý',
  })
  titles: string[];

  @ApiProperty({
    example: ['PROGRAMMING', 'DESIGN'],
    description: 'Danh mục gợi ý liên quan',
  })
  categories: string[];
}

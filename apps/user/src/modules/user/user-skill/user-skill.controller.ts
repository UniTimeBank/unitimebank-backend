import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBody,
} from '@nestjs/swagger';
import { UserSkillService } from './user-skill.service';
import {
  CreateSkillDto,
  UpdateSkillDto,
  SkillDto,
  GetMySkillsResponseDto,
} from '@app/contracts/user';
import { JwtAuthGuard } from '@app/common/guards/jwt-auth.guard';

@ApiTags('User - Skills')
@Controller('users')
export class UserSkillController {
  constructor(private readonly userSkillService: UserSkillService) {}

  /** Lấy danh sách kỹ năng của user hiện tại */
  @Get('me/skills')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lấy danh sách kỹ năng của tôi' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách kỹ năng',
    type: GetMySkillsResponseDto,
  })
  async getMySkills(@Req() req: any): Promise<GetMySkillsResponseDto> {
    return this.userSkillService.getMySkills(req.user.id);
  }

  /** Lấy danh sách kỹ năng công khai của một user */
  @Get(':userId/skills')
  @ApiOperation({ summary: 'Lấy danh sách kỹ năng công khai của người dùng' })
  @ApiResponse({
    status: 200,
    description: 'Danh sách kỹ năng công khai',
    type: GetMySkillsResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy người dùng' })
  async getSkillsByUserId(
    @Param('userId') userId: string,
  ): Promise<GetMySkillsResponseDto> {
    return this.userSkillService.getSkillsByUserId(userId);
  }

  /** Thêm kỹ năng mới */
  @Post('me/skills')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Thêm kỹ năng mới' })
  @ApiBody({ type: CreateSkillDto })
  @ApiResponse({
    status: 201,
    description: 'Thêm kỹ năng thành công',
    type: SkillDto,
  })
  @ApiResponse({ status: 409, description: 'Kỹ năng đã tồn tại' })
  async createSkill(
    @Req() req: any,
    @Body() dto: CreateSkillDto,
  ): Promise<SkillDto> {
    return this.userSkillService.createSkill(req.user.id, dto);
  }

  /** Cập nhật kỹ năng */
  @Patch('me/skills/:skillId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cập nhật kỹ năng (tên, danh mục, kỹ năng thế mạnh)' })
  @ApiBody({ type: UpdateSkillDto })
  @ApiResponse({
    status: 200,
    description: 'Cập nhật kỹ năng thành công',
    type: SkillDto,
  })
  @ApiResponse({ status: 404, description: 'Không tìm thấy kỹ năng' })
  @ApiResponse({ status: 409, description: 'Tên kỹ năng bị trùng' })
  async updateSkill(
    @Req() req: any,
    @Param('skillId') skillId: string,
    @Body() dto: UpdateSkillDto,
  ): Promise<SkillDto> {
    return this.userSkillService.updateSkill(req.user.id, skillId, dto);
  }

  /** Xóa kỹ năng */
  @Delete('me/skills/:skillId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Xóa kỹ năng' })
  @ApiResponse({ status: 200, description: 'Xóa thành công' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy kỹ năng' })
  async deleteSkill(
    @Req() req: any,
    @Param('skillId') skillId: string,
  ): Promise<{ message: string }> {
    return this.userSkillService.deleteSkill(req.user.id, skillId);
  }
}

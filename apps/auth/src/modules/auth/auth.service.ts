import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ClientProxy, Transport } from '@nestjs/microservices';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '@app/common/email';
import { UserAccount } from './entities/user-account.entity';
import { OtpRecord } from './entities/otp-record.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthSession } from './entities/auth-session.entity';
import { OAuthCredential } from './entities/oauth-credential.entity';
import { Role, AccountStatus, OtpPurpose } from './enums';
import { RegisterDto, LoginDto, VerifyOtpDto, GoogleAuthDto, SetPasswordDto } from '@app/contracts/auth';
import { USER_EVENTS } from '@app/contracts/events';

@Injectable()
export class AuthService {
  private readonly OTP_EXPIRY = 5 * 60;
  private readonly MAX_OTP_ATTEMPTS = 5;
  private readonly googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  constructor(
    @InjectRepository(UserAccount)
    private readonly userAccountRepo: Repository<UserAccount>,
    @InjectRepository(OtpRecord)
    private readonly otpRepo: Repository<OtpRecord>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(AuthSession)
    private readonly authSessionRepo: Repository<AuthSession>,
    @InjectRepository(OAuthCredential)
    private readonly oauthCredentialRepo: Repository<OAuthCredential>,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  // ==================== ĐĂNG KÝ ====================

  async register(dto: RegisterDto) {
    const existing = await this.userAccountRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email đã được đăng ký');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const userAccount = this.userAccountRepo.create({
      email: dto.email,
      passwordHash,
      role: Role.USER,
      status: AccountStatus.PENDING_VERIFY,
      trustScore: 50,
    });
    await this.userAccountRepo.save(userAccount);

    const otp = this.generateOtp();
    await this.saveOtp(dto.email, otp, OtpPurpose.REGISTER);

    // Gửi OTP qua email
    await this.emailService.sendOtp(dto.email, otp, 'REGISTER');

    return {
      message: 'Đã gửi mã OTP đến email của bạn',
      email: dto.email,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const userAccount = await this.userAccountRepo.findOne({
      where: { email: dto.email },
    });
    if (!userAccount) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const isValid = await this.verifyOtpCode(dto.email, dto.code, dto.purpose);
    if (!isValid) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    userAccount.status = AccountStatus.ACTIVE;
    await this.userAccountRepo.save(userAccount);

    const { accessToken, refreshToken } = await this.generateTokens(userAccount);

    await this.otpRepo.update(
      { email: dto.email, purpose: dto.purpose, consumed: false },
      { consumed: true },
    );

    // Ghi lại AuthSession vào bảng auth_session
    await this.recordSession(userAccount.id);

    // Emit event tạo user-profile khi đăng ký thành công (bất đồng bộ)
    if (dto.purpose === OtpPurpose.REGISTER) {
      this.userClient.emit(USER_EVENTS.USER_REGISTERED, {
        eventType: 'USER_REGISTERED',
        userId: userAccount.id,
        email: userAccount.email,
        timestamp: new Date().toISOString(),
      });
      // Gửi email chào mừng (bất đồng bộ)
      this.emailService.sendWelcome(dto.email).catch(() => {});
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400,
      user: {
        id: userAccount.id,
        email: userAccount.email,
        role: userAccount.role,
        status: userAccount.status,
      },
    };
  }

  // ==================== ĐĂNG NHẬP ====================

  async login(dto: LoginDto) {
    const userAccount = await this.userAccountRepo.findOne({
      where: { email: dto.email },
    });
    if (!userAccount) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (userAccount.status === AccountStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }
    if (userAccount.status === AccountStatus.PENDING_VERIFY) {
      throw new UnauthorizedException('Vui lòng xác thực email trước');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, userAccount.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const { accessToken, refreshToken } = await this.generateTokens(userAccount);

    // Ghi lại AuthSession vào bảng auth_session
    await this.recordSession(userAccount.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400,
      user: {
        id: userAccount.id,
        email: userAccount.email,
        role: userAccount.role,
      },
    };
  }

  // ==================== ĐĂNG NHẬP GOOGLE ====================

  async googleLogin(dto: GoogleAuthDto) {
    let email: string = '';
    let googleSubId: string = '';
    let name: string | undefined = dto.displayName;

    try {
      if (process.env.GOOGLE_CLIENT_ID) {
        const ticket = await this.googleClient.verifyIdToken({
          idToken: dto.idToken,
          audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (payload && payload.email) {
          email = payload.email;
          googleSubId = payload.sub || payload.email;
          name = name || payload.name;
        }
      }
    } catch {
      // Fallback
    }

    if (!email) {
      try {
        const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${dto.idToken}`);
        if (res.ok) {
          const payload = await res.json();
          if (payload.email) {
            email = payload.email;
            googleSubId = payload.sub || payload.email;
            name = name || payload.name;
          }
        }
      } catch {
        // Fallback userinfo
      }
    }

    if (!email) {
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${dto.idToken}` },
        });
        if (res.ok) {
          const profile = await res.json();
          if (profile.email) {
            email = profile.email;
            googleSubId = profile.sub || profile.email;
            name = name || profile.name;
          }
        }
      } catch {
        // Error
      }
    }

    if (!email) {
      throw new UnauthorizedException('Xác thực Token Google thất bại hoặc không thể lấy email');
    }

    let isNewUser = false;
    let userAccount = await this.userAccountRepo.findOne({
      where: { email },
    });

    if (!userAccount) {
      isNewUser = true;
      const randomPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await bcrypt.hash(randomPassword, 12);

      userAccount = this.userAccountRepo.create({
        email,
        passwordHash,
        role: Role.USER,
        status: AccountStatus.ACTIVE,
        trustScore: 50,
      });
      await this.userAccountRepo.save(userAccount);

      this.emailService.sendWelcome(email, name).catch(() => {});
    } else {
      if (userAccount.status === AccountStatus.PENDING_VERIFY) {
        userAccount.status = AccountStatus.ACTIVE;
        await this.userAccountRepo.save(userAccount);
      }
      if (userAccount.status === AccountStatus.LOCKED) {
        throw new UnauthorizedException('Tài khoản đã bị khóa');
      }
    }

    // Ghi lại thông tin OAuth Credential vào bảng oauth_credential
    let oauthCred = await this.oauthCredentialRepo.findOne({
      where: { userId: userAccount.id, provider: 'google' },
    });
    if (!oauthCred) {
      oauthCred = this.oauthCredentialRepo.create({
        userId: userAccount.id,
        provider: 'google',
        providerUserId: googleSubId || email,
      });
      await this.oauthCredentialRepo.save(oauthCred);
    }

    // Emit event tạo user-profile nếu đây là tài khoản mới tạo qua Google
    if (isNewUser) {
      this.userClient.emit(USER_EVENTS.USER_REGISTERED, {
        eventType: 'USER_REGISTERED',
        userId: userAccount.id,
        email: userAccount.email,
        timestamp: new Date().toISOString(),
      });
    }

    // Ghi lại AuthSession vào bảng auth_session
    await this.recordSession(userAccount.id);

    const { accessToken, refreshToken } = await this.generateTokens(userAccount);

    return {
      accessToken,
      refreshToken,
      expiresIn: 86400,
      isNewUser,
      user: {
        id: userAccount.id,
        email: userAccount.email,
        role: userAccount.role,
        status: userAccount.status,
      },
    };
  }

  // ==================== THIẾT LẬP MẬT KHẨU ====================

  async setPassword(userId: string, dto: SetPasswordDto) {
    const userAccount = await this.userAccountRepo.findOne({
      where: { id: userId },
    });
    if (!userAccount) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    if (userAccount.status === AccountStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    userAccount.passwordHash = passwordHash;
    await this.userAccountRepo.save(userAccount);

    return {
      message: 'Thiết lập mật khẩu thành công. Bây giờ bạn có thể đăng nhập bằng email và mật khẩu mới.',
    };
  }

  // Đổi mật khẩu khi đã đăng nhập - yêu cầu verify mật khẩu cũ
  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const userAccount = await this.userAccountRepo.findOne({
      where: { id: userId },
    });
    if (!userAccount) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    if (userAccount.status === AccountStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    // Verify mật khẩu cũ
    const isOldPasswordValid = await bcrypt.compare(oldPassword, userAccount.passwordHash);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }

    if (oldPassword === newPassword) {
      throw new BadRequestException('Mật khẩu mới phải khác mật khẩu hiện tại');
    }

    if (newPassword.length < 8) {
      throw new BadRequestException('Mật khẩu mới phải có ít nhất 8 ký tự');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    userAccount.passwordHash = passwordHash;
    await this.userAccountRepo.save(userAccount);

    return {
      message: 'Đổi mật khẩu thành công.',
    };
  }

  // ==================== QUÊN MẬT KHẨU ====================

  async forgotPassword(email: string) {
    const userAccount = await this.userAccountRepo.findOne({
      where: { email },
    });

    if (!userAccount) {
      // Không tiết lộ email có tồn tại hay không để tránh user enumeration
      return {
        message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi mã OTP đến email của bạn.',
      };
    }

    if (userAccount.status === AccountStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    // Tạo và lưu OTP
    const otp = this.generateOtp();
    await this.saveOtp(email, otp, OtpPurpose.FORGOT_PASSWORD);

    // Gửi OTP qua email
    await this.emailService.sendOtp(email, otp, 'FORGOT_PASSWORD');

    return {
      message: 'Nếu email tồn tại trong hệ thống, chúng tôi đã gửi mã OTP đến email của bạn.',
      email,
    };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    // Xác thực OTP trước
    const isValid = await this.verifyOtpCode(email, code, OtpPurpose.FORGOT_PASSWORD);
    if (!isValid) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn');
    }

    // Tìm tài khoản
    const userAccount = await this.userAccountRepo.findOne({
      where: { email },
    });

    if (!userAccount) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    if (userAccount.status === AccountStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    // Cập nhật mật khẩu mới
    const passwordHash = await bcrypt.hash(newPassword, 12);
    userAccount.passwordHash = passwordHash;
    await this.userAccountRepo.save(userAccount);

    // Đánh dấu OTP đã sử dụng
    await this.otpRepo.update(
      { email, purpose: OtpPurpose.FORGOT_PASSWORD, consumed: false },
      { consumed: true },
    );

    return {
      message: 'Đặt lại mật khẩu thành công. Bây giờ bạn có thể đăng nhập bằng mật khẩu mới.',
    };
  }

  // ==================== LÀM MỚI TOKEN ====================

  async refreshToken(refreshToken: string) {
    try {
      this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET,
      });

      const storedToken = await this.refreshTokenRepo.findOne({
        where: { tokenHash: this.hashToken(refreshToken), revoked: false },
      });

      if (!storedToken || storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token không hợp lệ');
      }

      const userAccount = await this.userAccountRepo.findOne({
        where: { id: storedToken.userId },
      });
      if (!userAccount) {
        throw new UnauthorizedException('Không tìm thấy người dùng');
      }

      storedToken.revoked = true;
      await this.refreshTokenRepo.save(storedToken);

      const tokens = await this.generateTokens(userAccount);

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 86400,
      };
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
  }

  // ==================== ĐĂNG XUẤT ====================

  async logout(refreshToken: string) {
    if (refreshToken) {
      await this.refreshTokenRepo.update(
        { tokenHash: this.hashToken(refreshToken), revoked: false },
        { revoked: true },
      );
    }
    return { message: 'Đăng xuất thành công' };
  }

  // ==================== HÀM HỖ TRỢ ====================

  private async recordSession(userId: string, deviceId = 'web-browser', ipAddress = '127.0.0.1', userAgent = 'Web Client') {
    try {
      const session = this.authSessionRepo.create({
        userId,
        deviceId,
        ipAddress,
        userAgent,
        lastSeenAt: new Date(),
        inRoom: false,
      });
      await this.authSessionRepo.save(session);
    } catch (e) {
      console.error('Lỗi khi lưu auth_session:', e);
    }
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private async saveOtp(email: string, code: string, purpose: OtpPurpose) {
    await this.otpRepo.update({ email, purpose }, { consumed: true });

    const otp = this.otpRepo.create({
      email,
      code: await bcrypt.hash(code, 10),
      purpose,
      expiresAt: new Date(Date.now() + this.OTP_EXPIRY * 1000),
      attempts: 0,
      consumed: false,
    });
    await this.otpRepo.save(otp);
  }

  private async verifyOtpCode(email: string, code: string, purpose: OtpPurpose): Promise<boolean> {
    const otp = await this.otpRepo.findOne({
      where: { email, purpose, consumed: false },
      order: { createdAt: 'DESC' },
    });

    if (!otp || otp.expiresAt < new Date()) {
      return false;
    }

    if (otp.attempts >= this.MAX_OTP_ATTEMPTS) {
      return false;
    }

    const isValid = await bcrypt.compare(code, otp.code);
    if (!isValid) {
      otp.attempts += 1;
      await this.otpRepo.save(otp);
      return false;
    }

    return true;
  }

  private async generateTokens(user: UserAccount) {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: (process.env.JWT_ACCESS_EXPIRY || '1d') as any },
    );

    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      { expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as any },
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await this.refreshTokenRepo.save({
      userId: user.id,
      deviceId: 'default',
      tokenHash: this.hashToken(refreshToken),
      expiresAt,
      revoked: false,
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

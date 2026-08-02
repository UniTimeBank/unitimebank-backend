import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { otpTemplate, welcomeTemplate } from './templates';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }

  private getLogoPath(): string | null {
    const possiblePaths = [
      path.resolve(process.cwd(), 'libs/common/src/assets/Logo_white.png'),
      path.join(__dirname, '../assets/Logo_white.png'),
      path.join(__dirname, '../../assets/Logo_white.png'),
    ];
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  async sendOtp(email: string, otp: string, purpose: 'REGISTER' | 'FORGOT_PASSWORD') {
    const subject = purpose === 'REGISTER'
      ? 'Mã xác thực đăng ký tài khoản UniTime Bank'
      : 'Mã đặt lại mật khẩu UniTime Bank';

    const logoPath = this.getLogoPath();
    const attachments = logoPath
      ? [{ filename: 'Logo_white.png', path: logoPath, cid: 'logo', contentDisposition: 'inline' as const }]
      : [];

    const html = otpTemplate(otp, purpose, logoPath ? 'cid:logo' : '');

    try {
      await this.transporter.sendMail({
        from: `"UniTime Bank" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        html,
        attachments,
      });
    } catch (error) {
    }
  }

  async sendWelcome(email: string, displayName?: string) {
    const firstName = displayName ? displayName.split(' ')[0] : 'bạn';
    const logoPath = this.getLogoPath();
    const attachments = logoPath
      ? [{ filename: 'Logo_white.png', path: logoPath, cid: 'logo', contentDisposition: 'inline' as const }]
      : [];

    const html = welcomeTemplate(firstName, logoPath ? 'cid:logo' : '');

    try {
      await this.transporter.sendMail({
        from: `"UniTime Bank" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Chào mừng bạn đến với UniTime Bank!',
        html,
        attachments,
      });
      console.log(`[EMAIL] Đã gửi email chào mừng đến ${email}`);
    } catch (error) {
      console.error(`[EMAIL] Lỗi gửi email chào mừng đến ${email}:`, error.message);
    }
  }
}

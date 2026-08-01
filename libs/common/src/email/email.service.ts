import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import { otpTemplate, welcomeTemplate } from './templates';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private logoUrl: string;

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

    this.logoUrl = this.loadLogo();
  }

  private loadLogo(): string {
    try {
      const logoPath = path.join(__dirname, '../assets/Logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        return `data:image/png;base64,${logoBuffer.toString('base64')}`;
      }
    } catch (e) {
      console.warn('[EMAIL] Logo not found');
    }
    return '';
  }

  async sendOtp(email: string, otp: string, purpose: 'REGISTER' | 'FORGOT_PASSWORD') {
    const subject = purpose === 'REGISTER'
      ? 'Mã xác thực đăng ký tài khoản Unitimebank'
      : 'Mã đặt lại mật khẩu Unitimebank';

    const html = otpTemplate(otp, purpose, this.logoUrl);

    try {
      await this.transporter.sendMail({
        from: `"Unitimebank" <${process.env.EMAIL_USER}>`,
        to: email,
        subject,
        html,
      });
      console.log(`[EMAIL] Đã gửi OTP đến ${email}`);
    } catch (error) {
      console.error(`[EMAIL] Lỗi gửi OTP đến ${email}:`, error.message);
    }
  }

  async sendWelcome(email: string, displayName?: string) {
    const firstName = displayName ? displayName.split(' ')[0] : 'bạn';
    const html = welcomeTemplate(firstName, this.logoUrl);

    try {
      await this.transporter.sendMail({
        from: `"Unitimebank" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: '🎉 Chào mừng bạn đến với Unitimebank!',
        html,
      });
      console.log(`[EMAIL] Đã gửi email chào mừng đến ${email}`);
    } catch (error) {
      console.error(`[EMAIL] Lỗi gửi email chào mừng đến ${email}:`, error.message);
    }
  }
}

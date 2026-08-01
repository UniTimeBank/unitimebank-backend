export const otpTemplate = (otp: string, purpose: 'REGISTER' | 'FORGOT_PASSWORD', logoUrl: string): string => {
  const subject = purpose === 'REGISTER'
    ? 'Mã xác thực đăng ký tài khoản UniTime Bank'
    : 'Mã đặt lại mật khẩu UniTime Bank';

  const bodyText = purpose === 'REGISTER'
    ? 'Cảm ơn bạn đã đăng ký tài khoản UniTime Bank. Vui lòng sử dụng mã OTP bên dưới để xác thực email của bạn:'
    : 'Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Vui lòng sử dụng mã OTP bên dưới:';

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="UniTime Bank" width="90" style="display: block; margin: 0 auto 12px;" />`
    : `<h1 style="color: #ffffff; margin: 0 0 8px; font-size: 24px; font-weight: bold; font-family: Arial, sans-serif;">UniTime Bank</h1>`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #006B58; padding: 36px 32px; text-align: center;">
              ${logoHtml}
              <p style="color: #ffffff; margin: 0; font-size: 14px; opacity: 0.9; font-family: Arial, sans-serif;">
                Đổi credit, kết nối tri thức
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 32px 32px;">
              <h2 style="color: #1a1a1a; margin: 0 0 8px; font-size: 24px; font-family: Arial, sans-serif;">
                Xin chào!
              </h2>
              <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 28px; font-family: Arial, sans-serif;">
                ${bodyText}
              </p>

              <!-- OTP Box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="background-color: #f0f9f6; border: 2px dashed #006B58; border-radius: 12px;">
                      <tr>
                        <td style="padding: 24px 48px;">
                          <span style="font-size: 40px; font-weight: bold; letter-spacing: 12px; color: #006B58; font-family: Arial, sans-serif;">${otp}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Warning -->
              <div style="background-color: #fef3cd; border-radius: 8px; padding: 16px 20px; margin-top: 24px;">
                <p style="color: #856404; font-size: 13px; line-height: 1.6; margin: 0; font-family: Arial, sans-serif;">
                  <strong>Mã có hiệu lực trong 5 phút.</strong><br>
                  Vui lòng không chia sẻ mã này với bất kỳ ai.
                </p>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <hr style="border: none; border-top: 1px solid #eeeeee; margin: 0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa;">
              <p style="color: #999999; font-size: 12px; line-height: 1.6; margin: 0; text-align: center; font-family: Arial, sans-serif;">
                Nếu bạn không yêu cầu mã này, vui lòng bỏ qua email này.<br>
                © ${new Date().getFullYear()} UniTime Bank
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

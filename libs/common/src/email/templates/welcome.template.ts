export const welcomeTemplate = (firstName: string, logoUrl: string): string => {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Chào mừng đến với Unitimebank</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, Helvetica, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f4; padding: 40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color: #006B58; padding: 36px 32px; text-align: center;">
              <img src="${logoUrl}" alt="Unitimebank" width="90" style="display: block; margin: 0 auto 12px;" />
              <p style="color: #ffffff; margin: 0; font-size: 14px; opacity: 0.9; font-family: Arial, sans-serif;">
                Đổi credit, kết nối tri thức
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 40px 32px 32px;">
              <h2 style="color: #1a1a1a; margin: 0 0 8px; font-size: 26px; font-family: Arial, sans-serif;">
                Chào mừng ${firstName}!
              </h2>
              <p style="color: #4a4a4a; font-size: 15px; line-height: 1.7; margin: 0 0 28px; font-family: Arial, sans-serif;">
                Cảm ơn bạn đã tham gia <strong style="color: #006B58;">Unitimebank</strong> - nền tảng kết nối tri thức hàng đầu!
              </p>

              <!-- Features -->
              <div style="background-color: #f0f9f6; border-radius: 12px; padding: 28px; margin: 28px 0;">
                <h3 style="color: #006B58; margin: 0 0 20px; font-size: 18px; font-family: Arial, sans-serif;">
                  Ban co the lam gi?
                </h3>

                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 10px 0; vertical-align: top;">
                      <span style="font-size: 24px; display: inline-block; width: 36px; color: #006B58;">*</span>
                      <span style="color: #333; font-size: 14px; line-height: 1.5; font-family: Arial, sans-serif;">
                        <strong>Tro thanh Mentor</strong><br>
                        <span style="color: #666;">Chia se kien thuc va kiem credit</span>
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; vertical-align: top;">
                      <span style="font-size: 24px; display: inline-block; width: 36px; color: #006B58;">*</span>
                      <span style="color: #333; font-size: 14px; line-height: 1.5; font-family: Arial, sans-serif;">
                        <strong>Hoc tu Mentor</strong><br>
                        <span style="color: #666;">Ket noi voi nhung nguoi co kinh nghiem</span>
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; vertical-align: top;">
                      <span style="font-size: 24px; display: inline-block; width: 36px; color: #006B58;">*</span>
                      <span style="color: #333; font-size: 14px; line-height: 1.5; font-family: Arial, sans-serif;">
                        <strong>Doi Credit</strong><br>
                        <span style="color: #666;">Thanh toan cho cac buoi hoc</span>
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; vertical-align: top;">
                      <span style="font-size: 24px; display: inline-block; width: 36px; color: #006B58;">*</span>
                      <span style="color: #333; font-size: 14px; line-height: 1.5; font-family: Arial, sans-serif;">
                        <strong>Xay dung Uy tin</strong><br>
                        <span style="color: #666;">Nang cao thu hang qua cac buoi hoc chat luong</span>
                      </span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Bonus Credit -->
              <div style="background: linear-gradient(135deg, #006B58 0%, #00876a 100%); border-radius: 12px; padding: 24px; margin: 28px 0; text-align: center;">
                <p style="color: #ffffff; font-size: 16px; line-height: 1.6; margin: 0; font-family: Arial, sans-serif;">
                  <strong>30 credit</strong> đang cho ban!<br>
                  <span style="opacity: 0.9; font-size: 14px;">Bat dau hanh trinh hoc tap ngay hom nay.</span>
                </p>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 28px 0;">
                <a href="#" style="display: inline-block; background-color: #006B58; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: bold; font-family: Arial, sans-serif;">
                  Kham pha ngay
                </a>
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
                © ${new Date().getFullYear()} Unitimebank<br>
                <a href="#" style="color: #006B58; text-decoration: none;">Trung tam tro giup</a>
                |
                <a href="#" style="color: #006B58; text-decoration: none;">Chinh sach bao mat</a>
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

  return html;
};

#!/usr/bin/env bash

# ==============================================================================
# Script tự động triển khai / Cập nhật Backend UniTime Bank trên GCP VM
# Sử dụng: ./deploy.sh
# ==============================================================================

set -e

echo "🚀 =================================================="
echo "   BẮT ĐẦU TRIỂN KHAI BACKEND UNITIME BANK"
echo "   =================================================="

# 1. Kiểm tra file .env.production
if [ ! -f .env.production ]; then
    echo "❌ LỖI: Không tìm thấy file '.env.production'!"
    echo "💡 Hãy tạo file '.env.production' từ '.env.production.example' trước khi chạy script."
    exit 1
fi

# 2. Cập nhật mã nguồn từ Git (nếu đang trong Git repo)
if [ -d .git ]; then
    echo "📥 Đang kéo mã nguồn mới nhất từ Git..."
    git pull origin main || git pull
fi

# 3. Build & Khởi động Docker containers với Docker Compose Production
echo "🐳 Đang build và khởi động toàn bộ Microservices..."
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# 4. Dọn dẹp Docker images cũ/thừa để tiết kiệm dung lượng ổ đĩa VM
echo "🧹 Đang dọn dẹp Docker images không sử dụng..."
docker image prune -f

# 5. Hiển thị trạng thái các container
echo "✅ Triển khai hoàn tất! Danh sách các container đang chạy:"
docker compose -f docker-compose.prod.yml ps

echo "🎉 =================================================="
echo "   HỆ THỐNG ĐÃ SẴN SÀNG HOẠT ĐỘNG TRÊN GCP!"
echo "   Xem log hệ thống bằng lệnh: docker compose -f docker-compose.prod.yml logs -f"
echo "   =================================================="

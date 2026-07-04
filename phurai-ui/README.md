# Phurai Restaurant Management System

## 🚀 Quick Start (Local Development)

### Yêu cầu
- **Docker Desktop** (v4.0+) với Docker Compose v2
- **macOS** (Intel hoặc Apple Silicon M1/M2/M3), **Windows** (WSL2), hoặc **Linux**

> ⚠️ Dùng `docker compose` (có space) — **KHÔNG** dùng `docker-compose` (có gạch nối, phiên bản cũ)

---

### Setup lần đầu (1 lệnh)

```bash
cd phurai-ui
bash scripts/setup-local.sh
```

Script sẽ tự động:
1. 🐳 Khởi động MSSQL Server (Docker container)
2. ⏳ Chờ đến khi SQL Server sẵn sàng
3. 🗄️ Chạy file SQL để tạo database + seed data
4. 🚀 Khởi động backend + frontend app

**App sẽ chạy tại:** `http://localhost:5001`

---

### Các lệnh thường dùng

```bash
# Xem logs
docker logs phurai-app-local -f

# Dừng toàn bộ
docker compose --profile local down

# Reset database (xóa sạch và tạo lại)
docker compose --profile local down -v
bash scripts/setup-local.sh

# Rebuild app sau khi thay đổi code
docker compose --profile local down
docker compose --profile local up --build -d db
# chờ healthy, sau đó:
bash scripts/setup-local.sh
```

---

### Thông tin kết nối local DB

| Field    | Value             |
|----------|-------------------|
| Host     | `localhost`       |
| Port     | `1433`            |
| Database | `System_Restaurant` |
| User     | `sa`              |
| Password | `PhuraiLocal@2026` |

---

### Profiles Docker Compose

| Profile | Lệnh | Dùng khi |
|---------|------|----------|
| `local` | `docker compose --profile local up` | Dev offline, local MSSQL |
| `cloud` | `docker compose --profile cloud up` | Connect Azure SQL |

---

### Troubleshooting

#### `no service selected`
Phải chỉ định profile: `docker compose --profile local up`

#### `health: starting` mãi không đổi (Apple Silicon)
MSSQL chạy qua Rosetta emulation, cần ~60s. Cứ chờ.

#### `Login failed for user 'sa'`
Có thể volume cũ với password khác. Chạy: `docker compose --profile local down -v` rồi setup lại.

#### `Exception in thread Thread-4 (watch_events): KeyError: 'id'`
Đây là bug của `docker-compose` v1 (Python), **không phải lỗi app**. Dùng `docker compose` (v2) thay thế.

---

### Profiles & môi trường

- **`.env`** — Cấu hình runtime (Azure SQL production, SMTP, JWT...)
- **`docker-compose.yml`** — Profile `local` dùng MSSQL container riêng, override `DB_SERVER` và `DB_PASSWORD`
- **`database/System_Restaurant.sql`** — Schema + seed data

---

### GitHub Actions (CI/CD)

Push lên branch `main` tự động:
- Build Docker image cho **linux/amd64** và **linux/arm64**
- Push lên GitHub Container Registry (`ghcr.io`)

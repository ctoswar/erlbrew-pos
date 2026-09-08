# Deployment

## Prerequisites

- Docker & Docker Compose
- MySQL 8 (or use Docker)
- Raspberry Pi (optional, for receipt printing)

---

## Quick Start (Docker)

```bash
# Clone the repository
git clone https://github.com/ctoswar/erlbrew-pos.git
cd erlbrew-pos/infra

# Create environment file
cp ../server/.env.example ../server/.env
# Edit ../server/.env with your settings

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

**Access:**
- Frontend: http://localhost:3004
- Backend API: http://localhost:3001

---

## Production Deployment

### 1. Server Setup

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone repository
git clone https://github.com/ctoswar/erlbrew-pos.git
cd erlbrew-pos
```

### 2. Environment Configuration

Create `server/.env`:

```env
# Database
DATABASE_URL=mysql://user:password@db-host:3306/erlbrew_pos

# Security (generate with: openssl rand -hex 32)
JWT_SECRET=your-secure-random-string-here

# CORS (your domain)
CORS_ORIGINS=https://pos.yourdomain.com

# Google Sheets (optional)
GOOGLE_SHEETS_ID=
GOOGLE_SERVICE_ACCOUNT_KEY=

# Print Server (Raspberry Pi)
PRINT_SERVER_URL=https://192.168.1.100:9100
```

### 3. Docker Compose (Production)

Create `docker-compose.prod.yml`:

```yaml
services:
  erlbw-api:
    build: ./server
    restart: always
    env_file: ./server/.env
    environment:
      NODE_ENV: production
    ports:
      - "3001:3001"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:3001/api/menu"]
      interval: 30s
      timeout: 10s
      retries: 3

  erlbrew-pos:
    build: .
    restart: always
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      erlbw-api:
        condition: service_healthy

  db:
    image: mysql:8
    restart: always
    environment:
      MYSQL_ROOT_PASSWORD: your-root-password
      MYSQL_DATABASE: erlbrew_pos
    volumes:
      - mysql-data:/var/lib/mysql
    ports:
      - "3306:3306"

volumes:
  mysql-data:
```

### 4. SSL/TLS Setup

For HTTPS, use Certbot:

```bash
# Install certbot
apt install certbot

# Get certificate
certbot certonly --standalone -d pos.yourdomain.com

# Copy to nginx
cp /etc/letsencrypt/live/pos.yourdomain.com/fullchain.pem ./ssl/cert.pem
cp /etc/letsencrypt/live/pos.yourdomain.com/privkey.pem ./ssl/key.pem
```

### 5. Start Production

```bash
docker compose -f docker-compose.prod.yml up -d
```

---

## Raspberry Pi Print Server

### Setup

```bash
# On Raspberry Pi
git clone https://github.com/ctoswar/erlbrew-pos.git
cd erlbrew-pos/print-server

# Install dependencies
pip install -r requirements.txt

# Configure
cp .env.example .env
# Edit .env with Bluetooth printer MAC

# Run
python print-server.py
```

### Docker (Pi)

```bash
cd print-server
docker compose up -d
```

---

## Database Setup

### Initial Schema

```bash
# Connect to MySQL
mysql -u root -p

# Create database
CREATE DATABASE erlbrew_pos;

# Import schema
mysql -u root -p erlbrew_pos < server/src/db/init.sql
```

### Backup

```bash
# Backup
mysqldump -u root -p erlbrew_pos > backup.sql

# Restore
mysql -u root -p erlbrew_pos < backup.sql
```

---

## Monitoring

### Health Checks

```bash
# API health
curl http://localhost:3001/api/menu

# Docker health
docker compose ps
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f erlbw-api

# Last 100 lines
docker compose logs --tail 100 erlbw-api
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Change PORT in .env or stop conflicting service |
| Database connection refused | Check MySQL is running and DATABASE_URL is correct |
| JWT error | Ensure JWT_SECRET is set and consistent |
| CORS error | Add your domain to CORS_ORIGINS |
| Print server unreachable | Check Pi IP and PRINT_SERVER_URL |

### Reset Everything

```bash
# Stop and remove all containers
docker compose down -v

# Remove images
docker compose down --rmi all

# Start fresh
docker compose up -d --build
```

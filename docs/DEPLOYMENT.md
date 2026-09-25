# Sagar Netra 3D — Deployment & Operations Guide

This guide details deployment procedures for local development, standalone Docker containers, and production Kubernetes/NGINX infrastructure.

---

## 1. Quick Start (Local Development)

### Prerequisites
- Node.js $\ge 20.0$ and `pnpm`
- Python $\ge 3.10$

### Frontend
```bash
# Install dependencies
pnpm install

# Start Next.js development server
pnpm dev
# Accessible at http://localhost:3000 (or http://localhost:3001)
```

### Backend (Optional for live NetCDF streaming)
```bash
# Set up Python virtual environment
python -m venv .venv
source .venv/bin/activate  # Or on Windows: .venv\Scripts\activate

# Install requirements
pip install -r backend/requirements.txt

# Start FastAPI server
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
# API Docs accessible at http://localhost:8000/docs
```

---

## 2. Docker Compose Deployment (Recommended)

Run the full dual-stack application with a single command:

```bash
# Build and start both frontend and backend
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

### Container Services
- **`frontend`**: Production NGINX container serving the compiled static WebGL export on port `3000`.
- **`backend`**: FastAPI container with xarray/NetCDF4 data slicing engine on port `8000`.

---

## 3. Production Static Hosting (Offline Zero-Cloud Deploy)

The frontend can be built as a pure offline static bundle requiring zero runtime servers:

```bash
pnpm build
# Static export is output to ./out
```

The `./out` directory can be deployed directly to:
- INCOIS On-Premises Web Servers (Apache/NGINX)
- Local offline exhibition kiosks
- Netlify, Vercel, or AWS S3 + CloudFront

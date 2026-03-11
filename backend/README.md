# Backend Server (Express + Supabase)

## Installation

```bash
cd backend
npm install
```

## Configuration

1. Copy `.env` file และเพิ่ม Supabase credentials:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key
PORT=5000
NODE_ENV=development
```

## Running the Server

```bash
# Production
npm start

# Development (with auto-reload)
npm run dev
```

## API Endpoints

- `GET /api/health` - Server health check
- `GET /api/data` - Fetch all data
- `POST /api/data` - Create new data
- `PUT /api/data/:id` - Update data
- `DELETE /api/data/:id` - Delete data

## Environment Variables

- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_ANON_KEY` - Anon key (for client-side)
- `SUPABASE_SERVICE_KEY` - Service key (for server-side, keep secret!)
- `PORT` - Server port (default: 5000)

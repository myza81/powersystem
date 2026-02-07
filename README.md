# PowerSystem Project

This project is a Django-based power system analysis tool with a React frontend (Vite).

## Prerequisites

- Python 3.8+
- Node.js 16+
- Redis (for Celery tasks)

## Setup Instructions

### 1. Backend Setup

Ensure you are in the project root and have your virtual environment activated.

```bash
# Install Python dependencies
pip install -r requirements.txt

# Migrate database
python manage.py migrate

# Create a superuser
python manage.py createsuperuser
```

### 2. Frontend Setup

Navigate to the `frontend` directory.

```bash
cd frontend

# Install Node dependencies
npm install

# Build the frontend (optional, for production)
npm run build
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure your keys.

```bash
cp .env.example .env
```

## Running the Application

### Start Backend Server

```bash
python manage.py runserver
```

### Start Frontend Dev Server

```bash
cd frontend
npm run dev
```

## Architecture

- **Backend**: Django Rest Framework
- **Frontend**: React + Vite
- **Tasks**: Celery + Redis

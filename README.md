# WanderPlan — Personalized Travel Itinerary Planner

🌐 **Live Demo:** https://personalized-travel-itinerary-plann-nine.vercel.app/

> ⚠️ **Development Deployment:** This application is deployed for development and demonstration purposes. It may occasionally be unavailable or some features may fail due to AI API rate limits, database limits, authentication email limits, or temporary service outages. Please keep this in mind while testing the application.

## About the Project

WanderPlan is a personalized travel itinerary planner designed to help users discover destinations and generate travel itineraries with the assistance of AI.

The project combines a React frontend, a Node.js backend, Supabase services, and an AI API to provide a travel-planning experience.

## Features

- **AI-powered itinerary generation** — Generate personalized travel plans with AI.
- **Destination recommendations** — Discover travel destinations.
- **User authentication** — Sign in using Supabase magic-link authentication.
- **Database integration** — Use Supabase for database-related functionality.
- **Full-stack architecture** — Separate frontend and backend applications.

*Feature availability may vary while the project is under development.*

## Tech Stack

| Technology | Purpose |
|---|---|
| React | Frontend UI |
| Vite | Frontend development and build tooling |
| Node.js | Backend runtime |
| Express.js | Backend API |
| Supabase | Authentication and PostgreSQL database |
| Groq API | AI-powered functionality |
| Vercel | Frontend deployment |
| Render | Backend deployment |

## Live Application

Visit the application:

**https://personalized-travel-itinerary-plann-nine.vercel.app/**

The frontend communicates with a separately deployed backend API. Availability depends on the hosting services and the external services used by the application.

## Known Limitations

- AI requests may fail when the AI provider's API rate limit or usage quota is reached.
- Database operations may be affected by database usage limits or temporary service issues.
- Sign-in emails may be delayed or temporarily unavailable due to authentication email rate limits.
- The backend may take some time to respond after a period of inactivity.
- The application is a work in progress, so bugs and incomplete features may occur.

These limitations are expected for a development deployment and do not necessarily indicate a permanent issue with the application.

## Running Locally

### Prerequisites

- Node.js and npm
- A Supabase project
- A Groq API key

### 1. Clone the repository

```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_PROJECT_DIRECTORY>
```

Replace the placeholders with your repository URL and project directory.

### 2. Configure the backend

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory and configure the environment variables required by the application.

For example:

```env
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173
SUPABASE_URL=your_supabase_url
SUPABASE_SECRET_KEY=your_supabase_secret_key
GROQ_API_KEY=your_groq_api_key
```

Use the variable names required by the actual backend configuration. Never commit your `.env` file or expose secret keys publicly.

Start the backend:

```bash
npm start
```

### 3. Configure the frontend

Open a separate terminal:

```bash
cd frontend
npm install
```

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:10000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Make sure the API URL matches the port on which your backend is running.

Start the frontend development server:

```bash
npm run dev
```

Open the local URL displayed by Vite, usually:

http://localhost:5173

## Project Status

WanderPlan is an ongoing development project. Features, reliability, and deployment configuration may change as development continues.

## Disclaimer

This project is intended for learning, development, and demonstration purposes. AI-generated recommendations and itineraries should be reviewed before relying on them for real-world travel decisions.

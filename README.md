# Vault - Personal Link & Note Manager

A web application for organizing and managing your links, notes, and digital content. Built with Next.js, React, TypeScript, and Supabase.

## Features

- **Link Management**: Save links with automatic metadata extraction (titles, descriptions, favicons)
- **Notes**: Create and edit notes with markdown support
- **Folder Organization**: Organize links and notes into folders with custom colors
- **Tags**: Categorize and filter your content with tags
- **Search**: Find links and notes across your entire collection
- **Dark/Light Mode**: Switch between themes
- **Responsive Design**: Works on desktop, tablet, and mobile
- **PWA Support**: Install as a web app on your device
- **Offline Mode**: Works offline with local storage
- **Secure**: User authentication with row-level database security

## Installation

### Requirements

- Node.js 18 or higher
- npm or yarn

### Quick Setup

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd vault
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3201
   ```

That's it! The app runs with local storage by default.

### With Supabase (Optional)

To use cloud storage and authentication:

1. Create a [Supabase](https://supabase.com) project
2. Create `.env.local` file with your credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Run the database setup in Supabase SQL editor:
   ```bash
   # Copy contents from setup_database.sql and run in Supabase
   ```

4. Restart the development server

## Available Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run linting checks
```

## Technology Stack

- Next.js 14
- React 18
- TypeScript
- Supabase (PostgreSQL)
- Tailwind CSS
- Radix UI

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect the repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Deploy to Other Platforms

The app can be deployed to any platform that supports Node.js:
- Netlify
- Railway
- DigitalOcean
- AWS
- Heroku

## License

MIT License
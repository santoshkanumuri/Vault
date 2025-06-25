# 🔐 Vault - Personal Link & Note Manager

A modern, full-stack web application for organizing and managing your links, notes, and digital content. Built with Next.js, React, TypeScript, and Supabase.

## ✨ Features

### 🔗 Link Management
- **Smart Link Saving**: Automatically fetch metadata, titles, descriptions, and favicons
- **Folder Organization**: Organize links into customizable folders with color coding
- **Tag System**: Tag links for easy categorization and filtering
- **URL Validation**: Robust URL validation and error handling
- **Metadata Refresh**: Update link metadata on demand

### 📝 Note Taking
- **Rich Notes**: Create and edit notes with full markdown support
- **Folder Integration**: Organize notes alongside links in the same folder structure
- **Tag Support**: Apply tags to notes for better organization
- **Search Functionality**: Full-text search across all notes and links

### 🎨 User Experience
- **Dark/Light Mode**: Seamless theme switching
- **Responsive Design**: Optimized for desktop, tablet, and mobile
- **PWA Support**: Install as a Progressive Web App
- **Modern UI**: Clean, intuitive interface built with Radix UI and Tailwind CSS
- **Real-time Updates**: Instant updates across all devices

### 🔐 Security & Data
- **User Authentication**: Secure signup/signin with Supabase Auth
- **Row Level Security**: Database-level security ensuring users only access their data
- **ACID Compliance**: Robust database operations with transaction integrity
- **Data Validation**: Comprehensive input validation and error handling
- **Offline Fallback**: Local storage fallback when offline

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (optional - app works offline with localStorage)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd vault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure Environment Variables** (Optional for Supabase)
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

5. **Set up Database** (Optional - if using Supabase)
   - Create a new Supabase project
   - Run the SQL script from `setup_database.sql` in your Supabase SQL Editor
   - This will create all necessary tables, policies, and triggers

6. **Start Development Server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to `http://localhost:3201`

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **UI Components**: Radix UI, Tailwind CSS, Lucide Icons
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Authentication**: Supabase Auth
- **Metadata Fetching**: Custom API routes with JSDOM
- **State Management**: React Context API
- **Validation**: Custom validation with error handling
- **PWA**: Service Worker with offline support

### Project Structure
```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── globals.css       # Global styles
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/            # React components
│   ├── auth/             # Authentication components
│   ├── folders/          # Folder management
│   ├── tags/             # Tag management
│   └── ui/               # UI components
│       ├── layout/       # Layout components
│       ├── links/        # Link components
│       └── notes/        # Note components
├── contexts/             # React contexts
│   ├── AuthContext.tsx  # Authentication state
│   └── AppContext.tsx   # Application state
├── lib/                  # Utilities and services
│   ├── services/        # Database services
│   ├── utils/           # Utility functions
│   ├── storage.ts       # Local storage helpers
│   ├── supabase.ts      # Supabase client
│   └── types.ts         # TypeScript types
├── public/              # Static assets
└── scripts/             # Build scripts
```

## 🗄️ Database Schema

### Core Tables
- **users**: User profiles and preferences
- **folders**: Organizational folders with colors
- **tags**: Categorization tags with colors
- **links**: Saved links with metadata
- **notes**: User notes and content
- **link_tags**: Many-to-many link-tag relationships
- **note_tags**: Many-to-many note-tag relationships

### Key Features
- UUID primary keys for all tables
- Row Level Security (RLS) policies
- Cascade deletes for data integrity
- JSONB metadata storage for links
- Full-text search indexes
- Optimized query performance

## 🔧 Configuration

### Environment Variables
```env
# Supabase Configuration (Optional)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3201
```

### Supabase Setup
1. Create a new Supabase project
2. Copy your project URL and anon key to `.env.local`
3. Run the database setup script:
   ```sql
   -- Copy and run the contents of setup_database.sql
   -- This creates tables, policies, triggers, and indexes
   ```

### Offline Mode
The app automatically falls back to localStorage when Supabase is not configured, providing:
- Local data persistence
- Full CRUD operations
- Cross-session data retention
- Authentication simulation

## 🛠️ Development

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run generate-icons # Generate PWA icons
```

### Development Guidelines
- Follow TypeScript strict mode
- Use React hooks and functional components
- Implement proper error handling
- Validate all user inputs
- Follow ACID principles for data operations
- Maintain responsive design principles

### Adding New Features
1. Define types in `lib/types.ts`
2. Create database service functions in `lib/services/database.ts`
3. Add UI components with proper validation
4. Update contexts for state management
5. Add proper error handling and loading states

## 🧪 Testing

The application includes:
- Input validation for all forms
- URL validation for links
- Error boundary implementations
- Database transaction integrity
- Cross-browser compatibility testing

## 📱 PWA Features

- **Installable**: Add to home screen on mobile/desktop
- **Offline Support**: Core functionality works offline
- **Service Worker**: Caches assets for faster loading
- **App Manifest**: Proper PWA configuration
- **Icons**: Full icon set for all platforms

## 🔒 Security

### Implemented Security Measures
- **Row Level Security**: Database-level access control
- **Input Validation**: All inputs validated and sanitized
- **CSRF Protection**: Built-in Next.js protection
- **SQL Injection Prevention**: Parameterized queries via Supabase
- **XSS Prevention**: React's built-in XSS protection
- **Authentication**: Secure JWT-based authentication

### Data Privacy
- User data is isolated per account
- No data sharing between users
- Optional local-only mode available
- Regular security updates

## 🚀 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically on push

### Other Platforms
- **Netlify**: Configure build command `npm run build`
- **Railway**: Automatic deployment from Git
- **DigitalOcean**: App Platform deployment

### Environment Variables for Production
```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup
1. Follow the installation steps above
2. Make your changes
3. Test thoroughly (both online and offline modes)
4. Ensure TypeScript compilation passes
5. Run linting: `npm run lint`

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎯 Roadmap

### Planned Features
- [ ] Import/Export functionality
- [ ] Link sharing and collaboration
- [ ] Advanced search filters
- [ ] Bulk operations
- [ ] API endpoints for external integrations
- [ ] Browser extension
- [ ] Mobile app (React Native)

### Performance Improvements
- [ ] Implement virtualization for large lists
- [ ] Add pagination for better performance
- [ ] Optimize bundle size
- [ ] Add caching strategies

## 🆘 Support

### Common Issues

**App won't start**
- Check Node.js version (18+ required)
- Run `npm install` to ensure dependencies are installed
- Check for port conflicts (default: 3201)

**Database connection issues**
- Verify Supabase URL and key in `.env.local`
- Check Supabase project status
- App will fall back to localStorage if Supabase unavailable

**Authentication problems**
- Clear browser storage and try again
- Check Supabase Auth configuration
- Verify RLS policies are properly set up

### Getting Help
- Check the Issues tab for known problems
- Create a new issue with detailed description
- Include browser console errors
- Specify whether using Supabase or localStorage mode

---

**Made with ❤️ using Next.js, React, and Supabase**
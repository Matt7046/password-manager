# Password Manager Mobile App - PRD

## Overview
A secure mobile password manager app built with React Native (Expo) that allows users to safely store, organize, and manage their passwords with encryption and biometric authentication.

## Core Features

### 1. Security & Authentication
- **Master Password**: Single master password to access all stored passwords
- **Biometric Authentication**: Fingerprint/Face ID support after initial login
- **Encryption**: All passwords encrypted using Fernet (AES-256) with key derived from master password
- **First-time Setup**: Guided setup flow for creating master password

### 2. Password Management
- **Create**: Add new password entries with:
  - Account name (required)
  - Username/email (required)
  - Password (required)
  - URL/website (optional)
  - Notes (optional)
  - Category
  - Custom tags
- **Read**: View all password details
- **Update**: Edit existing password entries
- **Delete**: Remove password entries with confirmation

### 3. Organization
- **Categories**: Pre-defined categories including:
  - Social Media
  - Email
  - Banking
  - Shopping
  - Work
  - Entertainment
  - Gaming
  - Travel
  - Education
  - Health
  - Other
- **Tags**: Custom tags for flexible organization
- **Filtering**: Filter passwords by category
- **Search**: Real-time search by account name or username

### 4. User Experience
- **Copy to Clipboard**: One-tap copy for username and password
- **Show/Hide Password**: Toggle password visibility
- **Pull to Refresh**: Update password list
- **Responsive Design**: Mobile-first with dark theme
- **Empty States**: Helpful messages when no passwords exist

## Technical Stack

### Frontend
- **Framework**: Expo SDK 54
- **Language**: TypeScript
- **Navigation**: expo-router (file-based routing)
- **State Management**: React Context API
- **UI Components**: React Native core components
- **Icons**: @expo/vector-icons (Ionicons)
- **Security**: expo-local-authentication, expo-secure-store, expo-clipboard

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **Authentication**: bcrypt for master password hashing
- **Encryption**: Fernet (cryptography library)
- **API Pattern**: RESTful API with /api prefix

### Database Schema

#### Users Collection
```json
{
  "user_id": "master_user",
  "master_password": "bcrypt_hashed_password",
  "created_at": "datetime"
}
```

#### Password Entries Collection
```json
{
  "_id": "ObjectId",
  "account_name": "string",
  "username": "string",
  "password": "encrypted_string",
  "url": "string",
  "notes": "string",
  "category": "string",
  "tags": ["string"],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## API Endpoints

### Authentication
- `GET /api/auth/check` - Check if master password is set up
- `POST /api/auth/setup` - Create master password (first time)
- `POST /api/auth/login` - Verify master password

### Password Management
- `GET /api/passwords` - Get all password entries (with master password)
- `POST /api/passwords` - Create new password entry
- `GET /api/passwords/{id}` - Get specific password entry
- `PUT /api/passwords/{id}` - Update password entry
- `DELETE /api/passwords/{id}` - Delete password entry
- `POST /api/passwords/search` - Search passwords by account name
- `GET /api/categories` - Get list of available categories

## Security Considerations
1. Master password is hashed using bcrypt before storage
2. Passwords are encrypted with Fernet using key derived from master password
3. Biometric authentication stores master password in secure storage
4. All API calls require master password verification
5. No password recovery - master password must be remembered
6. Passwords are decrypted only when retrieved

## User Flows

### First Time User
1. Open app → Setup screen
2. Create master password (min 6 characters)
3. Confirm password
4. Redirected to home (empty state)
5. Add first password

### Returning User
1. Open app → Login screen
2. Enter master password OR use biometric
3. View password list
4. Search, filter, or add new passwords

### Managing Passwords
1. Tap "+" button → Add password screen
2. Fill required fields (account, username, password)
3. Select category, add tags, notes
4. Save → Return to list
5. Tap password card → View details
6. Copy password/username with one tap
7. Edit or delete from detail view

## Design System
- **Colors**:
  - Background: #1a1a2e (dark navy)
  - Cards: #16213e (lighter navy)
  - Accent: #4ecdc4 (teal)
  - Text: #fff (white)
  - Secondary text: #999
  - Error: #ff6b6b
- **Typography**: System fonts, 14-32px sizes
- **Spacing**: 8pt grid system
- **Border Radius**: 12-16px for cards and buttons
- **Touch Targets**: Minimum 44x44 points

## Future Enhancements (Not Implemented)
- Password strength indicator
- Password generator
- Auto-fill integration
- Cloud sync
- Export/Import functionality
- Password sharing
- Browser extension
- Two-factor authentication
- Multiple vaults

## Testing
- Backend API fully tested (22 test cases)
- All CRUD operations verified
- Encryption/decryption validated
- Error handling confirmed

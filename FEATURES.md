# K-Smart Dryer - Feature Documentation

## Overview

K-Smart Dryer is a modern IoT-based intelligent Kamias (bilimbi fruit) drying system web application built with React. It provides real-time monitoring and control of a smart Kamias dryer machine with an elegant green theme.

## Key Features Implemented

### 1. Authentication System ✅

- **Login Page**: Modern, animated login interface
- **Gradient Background**: Animated floating orbs for visual appeal
- **Form Validation**: Email and password input validation
- **Loading State**: Loading spinner during authentication
- **Responsive Design**: Works on all screen sizes.

### 2. Dashboard ✅

Comprehensive IoT control panel with multiple sections:

#### A. Dryer Status Monitor

- **Real-time Status Display**: Shows current state (Idle, Running, Paused, Complete)
- **Visual Indicator**: Animated spinning dryer icon when running
- **Countdown Timer**: Live countdown showing remaining time (HH:MM:SS format)
- **Control Buttons**:
  - Start/Pause button with active state
  - Stop button to end cycle
- **Completion Alert**: Visual "Ready!" badge when cycle completes

#### B. Live Sensor Dashboard

Real-time monitoring with animated updates:

- **Temperature Sensor**: 25-80°C range with gradient icon
- **Humidity Sensor**: Percentage display with water droplet icon
- **Power Usage**: Real-time kW consumption monitoring
- **Progress Indicator**: Percentage-based progress tracking
- **Visual Progress Bar**: Animated gradient progress bar

#### C. Drying Modes

Four pre-configured intelligent modes for Kamias:

1. **Standard**: 55°C, 60 minutes - Perfect for regular Kamias batches
2. **Gentle**: 45°C, 45 minutes - For delicate Kamias preservation
3. **Quick Dry**: 65°C, 30 minutes - Fast drying when time is limited
4. **Preserve**: 40°C, 70 minutes - Maximum quality preservation mode

Features:

- Visual mode selection with icons
- Temperature and time display for each mode
- Active mode highlighting
- Disabled state during operation

#### D. Statistics Panel

- Kamias batches completed today
- Energy saved (kWh)
- Average drying time
- Quality score percentage

#### E. Smart Features

IoT-enabled intelligent features with toggle controls:

- Auto-Stop When Dry
- Quality Monitor for optimal Kamias preservation
- Energy Saver Mode
- Push Notifications

#### F. Activity Log

- Real-time Kamias drying activity tracking
- Timestamped events
- Recent Kamias batch operations history
- System maintenance logs

### 3. UI/UX Features ✅

#### Design System

- **Color Scheme**: Clean white background with emerald green accents (inspired by fresh Kamias)
- **Colors**:
  - Primary: Emerald green (#10b981)
  - Backgrounds: Pure white with light green tints (#f0fdf4, #dcfce7)
  - Borders: Soft green borders (#d1fae5, #a7f3d0)
  - Text: Dark green for excellent readability (#064e3b)
- **Typography**: Inter font family for modern, clean look
- **Icons**: Lucide React icons throughout in green
- **Cards**: White cards with subtle green borders and shadows
- **Glassmorphism**: Backdrop blur effects with light transparency
- **Animations**:
  - Spinning dryer icon
  - Floating green gradient orbs on login
  - Button hover effects with green glow
  - Progress animations with green gradients
  - Pulse effects on logo
  - Card hover transforms

#### Navigation

- **Top Navbar**: Persistent navigation with logo and controls
- **Notification Badge**: Shows unread notifications count
- **Quick Actions**: Settings and logout buttons
- **Responsive Layout**: Adapts to mobile, tablet, and desktop

#### Responsive Grid

- CSS Grid layout for card arrangement
- Auto-fit columns based on screen size
- Mobile-first responsive design
- Breakpoints at 768px and 1024px

### 4. Technical Features ✅

#### Real-time Simulation

- Live sensor data updates every second
- Realistic temperature progression (25°C → 80°C) for Kamias drying
- Humidity reduction simulation (85% → 10%) tracking Kamias moisture
- Variable power consumption
- Countdown timer with auto-completion

#### State Management

- React hooks for state management
- Authentication state persistence
- Dryer operation states
- Mode selection handling
- Real-time sensor updates

#### Routing

- React Router for navigation
- Protected routes with authentication
- Automatic redirects
- Clean URL structure

## Technology Stack

### Core

- **React 19** - Latest React version
- **Vite** - Next-generation build tool
- **React Router DOM 7** - Client-side routing

### UI/UX

- **Lucide React** - Beautiful icon library
- **CSS3** - Modern styling with animations
- **CSS Grid & Flexbox** - Responsive layouts
- **CSS Custom Properties** - Theme variables

### Development

- **npm** - Package management
- **ES6+ JavaScript** - Modern JavaScript
- **JSX** - React component syntax

## User Experience Highlights

### Visual Feedback

- Color-coded status badges (green=running, orange=paused, emerald=complete)
- Animated spinning icon during Kamias drying operation
- Progress bar with green gradient animation
- Button state changes (active, hover, disabled)
- Loading spinners for async operations

### Accessibility

- Semantic HTML elements
- Proper heading hierarchy
- Form labels and input associations
- Button states and disabled states
- Color contrast compliance

### Performance

- Fast loading with Vite
- Efficient React rendering
- CSS animations with GPU acceleration
- Optimized asset loading
- Minimal bundle size

## Future Enhancement Possibilities

### Backend Integration

- Real device connectivity via MQTT/WebSocket
- Cloud storage for cycle history
- User authentication with JWT
- Real-time notifications via push API
- Remote monitoring capabilities

### Advanced Features

- Machine learning for optimal Kamias drying times
- Energy cost calculations and recommendations
- Maintenance prediction algorithms
- Voice control integration
- Mobile app companion
- Multi-device support
- Scheduling and automation
- Weather-based drying recommendations
- Moisture content analysis
- Batch quality grading
- Export certification tracking

### Analytics

- Detailed usage statistics
- Energy consumption graphs
- Cycle performance metrics
- Maintenance tracking
- Cost analysis dashboard

## Installation & Usage

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser
http://localhost:5173

# Login with any credentials
Email: any@email.com
Password: any password

# Start using the Kamias drying dashboard
```

## Project Structure

```
KamyasDryer/
├── src/
│   ├── pages/
│   │   ├── Login.jsx           # Login page component
│   │   ├── Login.css           # Login styles
│   │   ├── Dashboard.jsx       # Main dashboard
│   │   └── Dashboard.css       # Dashboard styles
│   ├── App.jsx                 # Router & auth logic
│   ├── main.jsx                # App entry point
│   └── index.css               # Global styles
├── index.html                  # HTML template
├── vite.config.js             # Vite configuration
├── package.json               # Dependencies
└── README.md                  # Documentation
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome)

## License

MIT License - Free for personal and commercial use

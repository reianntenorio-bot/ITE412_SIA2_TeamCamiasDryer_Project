# K-Smart Dryer - Kamyas Smart Machine

An IoT-based intelligent Kamias (bilimbi fruit) drying system with real-time monitoring and smart controls.

## Features

### 🔐 Authentication
- Modern login page with animated gradient background
- Secure authentication flow

### 📊 Dashboard
- **Real-time Monitoring**: Live temperature, humidity, and power usage tracking
- **Multiple Drying Modes**: Standard, Gentle, Quick Dry, and Preserve modes for Kamias
- **Smart Controls**: Start, pause, and stop functionality
- **Progress Tracking**: Visual progress indicators and countdown timer
- **Statistics**: Daily batches, energy savings, and quality score metrics
- **Smart Features**: Auto-stop, quality monitor, energy saver mode
- **Activity Log**: Track recent Kamias drying activities

### 🎨 Design
- Clean white background with vibrant green accents
- Emerald green gradients and highlights throughout
- Light green backgrounds on cards and buttons
- Responsive design for all screen sizes
- Smooth animations and transitions
- Lucide React icons throughout
- Modern glassmorphism UI elements with subtle shadows

## Tech Stack

- **React** - UI framework
- **Vite** - Build tool
- **React Router** - Navigation
- **Lucide React** - Icon library
- **CSS3** - Styling with animations

## Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Usage

1. Open the application in your browser
2. Login with any credentials (demo mode)
3. Access the dashboard to control your Kamias dryer
4. Select a drying mode (Standard, Gentle, Quick Dry, Preserve)
5. Start the dryer and monitor real-time sensor data
6. View statistics and activity logs for Kamias drying

## Project Structure

```
KamyasDryer/
├── server/               # Products API (required for Manage Products & Shop)
│   └── npm run dev       # Runs on port 3001
├── ecommerce-client/     # Standalone e-commerce store (K-Smart Store)
│   └── npm run dev       # Runs on port 5174
├── src/
├── pages/
│   ├── Login.jsx          # Login page component
│   ├── Login.css          # Login page styles
│   ├── Dashboard.jsx      # Dashboard component
│   └── Dashboard.css      # Dashboard styles
├── App.jsx                # Main app with routing
├── main.jsx               # App entry point
└── index.css              # Global styles
```

## IoT Features

- **Temperature Monitoring**: Real-time temperature tracking (25-80°C) for optimal Kamias drying
- **Humidity Sensing**: Humidity levels during Kamias drying cycle
- **Power Monitoring**: Live power consumption tracking
- **Smart Automation**: Auto-stop when Kamias fruits are perfectly dry
- **Energy Efficiency**: Track and optimize energy usage
- **Quality Monitor**: Ensure optimal drying quality for Kamias preservation
- **Cycle Notifications**: Get notified when Kamias drying cycle completes

## Future Enhancements

- Mobile app integration
- Voice control support
- Machine learning for optimal Kamias drying times
- Remote monitoring via smartphone
- Maintenance predictions
- Energy cost calculations
- Integration with smart home systems
- Batch quality analysis
- Moisture content prediction
- Export quality certification

## License

MIT

## Author

Kamyas IoT Solutions

# Camias Dryer

An IoT-based drying system with real-time monitoring, automated drying control, solar-assisted power, and an integrated e-commerce platform for dried camias products.

**Course:** ITE412 – System Integration and Architecture 2

**Team Name:** Camias Dryer

## Team Members & Roles

1. **Project Lead:** Nathaniel J. Caringal
2. **Documenter:** Rei Ann D. Tenorio
3. **Diagrammer:** Christian Dominic Garibay
4. **Presenter:** Reishell A. Garilao
5. **Researcher:** Harvey D. Macalalad

## Project Title

**CAMIAS DRYER: AN IoT BASED DRYING SYSTEM WITH E-COMMERCE FOR AGRIGOLD FARM LEARNING CENTER INC.**

## Project Summary

The Camias Dryer is an IoT-based drying system with an integrated e-commerce platform developed for Agrigold Farm Learning Center Inc. The system aims to improve the traditional drying process by using temperature and humidity sensors, automated drying control, real-time monitoring, and a solar-assisted power source. It also provides an e-commerce feature that allows dried camias products to be displayed, managed, and sold online.

## Features

### Authentication

- Modern login page
- User authentication
- User access management
- Secure authentication flow

### Drying and Monitoring Dashboard

- Real-time temperature monitoring
- Real-time humidity monitoring
- Power usage monitoring
- Drying status monitoring
- Multiple drying modes
- Start, pause, and stop controls
- Drying progress tracking
- Countdown timer
- Daily batch statistics
- Energy-saving monitoring
- Drying activity logs
- Automated drying control
- Quality monitoring
- System notifications

### IoT Features

- ESP32-based device integration
- Temperature and humidity sensor monitoring
- Automated heating control
- Ventilation fan control
- Real-time sensor data transmission
- Wi-Fi connectivity
- Solar-assisted power integration
- Drying cycle monitoring
- Drying status synchronization

### E-Commerce

- Product listing
- Product management
- Inventory management
- Product browsing
- Shopping cart
- Online product ordering
- Order management
- Customer order information
- Delivery address management

## Tech Stack

### Frontend

- React
- Vite
- React Router
- JavaScript
- HTML
- CSS
- Lucide React

### Backend

- Node.js
- REST API
- Express-based server components

### Database and Cloud Services

- Firebase
- Firebase Authentication
- Firebase Firestore
- Firebase Realtime Database
- Firebase Storage

### IoT and Hardware

- ESP32 Microcontroller
- Temperature Sensor
- Humidity Sensor
- HX711 Load Cell Amplifier
- Heating Element
- Ventilation Fan
- Relay Module
- Solar Panel
- Solar Charge Controller
- DC-DC Buck Converter

### Development and Testing Tools

- Visual Studio Code
- Arduino IDE / PlatformIO
- Git
- GitHub
- Postman
- Figma
- Google Chrome

Test update - Chris

## Repository Structure

```text
CamiasDryer/
├── device/                  # ESP32 and IoT device code
├── ecommerce-client/        # E-commerce application
├── public/                  # Public assets
├── server/                  # Backend and server-side components
├── src/                     # Main application source code
├── docs/                    # Project documentation
├── tests/                   # Test cases
├── integration/             # Integration scripts and configurations
├── package.json             # Main project dependencies
├── package-lock.json
├── firebase.json            # Firebase configuration
├── firestore.rules          # Firestore security rules
├── firestore.indexes.json   # Firestore indexes
├── database.rules.json      # Realtime Database rules
├── vite.config.js           # Vite configuration
└── README.md                # Project documentation
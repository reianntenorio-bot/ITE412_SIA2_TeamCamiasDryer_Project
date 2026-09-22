# Project Overview

## 1. System Objectives

The Camias Dryer project aims to develop an IoT-based drying system with an integrated e-commerce platform for Agrigold Farm Learning Center Inc. The system addresses the limitations of traditional sun-drying methods such as inconsistent drying conditions, manual monitoring, dependence on weather conditions, and limited market access.

Specifically, the system aims to:

- Automate and control the camias drying process using IoT technology.
- Monitor temperature, humidity, drying status, and other relevant drying data in real time.
- Provide a web-based monitoring interface for managing and reviewing drying operations.
- Integrate a solar-assisted power system to support energy-efficient and sustainable drying.
- Provide an e-commerce platform for displaying, managing, and selling dried camias products online.

## 2. Proposed Scope

### Modules/Systems to Integrate

- IoT-Based Drying System
- Temperature and Humidity Monitoring
- Automated Heating and Airflow Control
- Real-Time Monitoring Dashboard
- Drying Records and History
- Product and Inventory Management
- E-Commerce and Online Ordering
- Notifications and Reports
- Firebase Cloud Database

### In-Scope Features

- User authentication and secure system access
- Real-time monitoring of temperature and humidity
- Automated control of the heating element and ventilation fan
- Monitoring of drying progress and system status
- Recording and viewing of drying history
- Product listing and management
- Inventory management
- Online product ordering
- Order management and tracking
- Notifications and system alerts
- Solar-assisted power integration
- Real-time synchronization of data through Firebase

### Out-of-Scope

- Industrial-scale mass production
- Processing of fruits and vegetables other than camias
- Advanced delivery and logistics management
- Integrated payment processing
- Large-scale commercial deployment

## 3. Stakeholders

- Agrigold Farm Learning Center Inc. — The primary beneficiary and system owner who will use the system for drying operations, monitoring, product management, and online selling.
- System Administrator/Staff — Responsible for monitoring the drying process, managing system data, products, inventory, and orders.
- Customers — Users who can browse available dried camias products and place orders through the e-commerce platform.
- Local Farmers — Potential beneficiaries who may benefit from improved camias preservation, reduced post-harvest losses, and wider market opportunities.

## 4. Tools & Technologies

### Languages/Frameworks

- HTML
- CSS
- JavaScript
- React
- Node.js

### IoT and Hardware Development

- ESP32 Microcontroller
- Temperature and Humidity Sensors
- HX711 Load Cell Amplifier
- Heating Element
- Ventilation Fan
- Relay Module
- Solar Panel
- Solar Charge Controller
- DC-DC Buck Converter
- Arduino IDE / PlatformIO

### Database and Backend

- Firebase Realtime Database
- Firebase Authentication
- Firebase Hosting

### Integration Approach

- IoT-based real-time data communication
- Wi-Fi connectivity
- Cloud-based data synchronization
- Integration between the dryer hardware, Firebase backend, web/mobile application, and e-commerce platform

### Repository and Development Services

- GitHub
- Visual Studio Code
- Firebase

### UI/UX and Testing Tools

- Figma
- Postman
- Google Chrome

## 5. Integration Pattern Applied

### Integration Pattern

**Hub-Spoke**

### Rationale

The Hub-Spoke integration pattern is appropriate for the Camias Dryer system because the REST API Server acts as the central hub for communication between the system modules. The IoT Sensors send sensor data through the API, while the Web Dashboard retrieves information from the central hub for monitoring. The Drying Monitoring Module and Drying Control Module also communicate through the REST API Server. The Product & Order Module and E-Commerce Frontend use API calls and database queries through the central hub. This pattern reduces direct dependencies between modules and provides a centralized way to manage communication within the system.

### Diagram Reference

![High-Level Architecture Diagram](HighLevelArch.png)
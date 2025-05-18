# Medical Alert System

This repository contains a microservices-based system for collecting, processing, and alerting on medical data using Early Warning Scores (EWS).

## System Overview

The system consists of three main microservices:

1. **Data Collector Service** - Collects sensor data from medical devices with RAFT consensus
2. **EWS Service** - Calculates Early Warning Scores based on vital signs using CQRS pattern
3. **Alert Engine Service** - Manages medical alerts and sends notifications through various channels

## Architecture

- **Data Flow**: Medical sensor data → Data Collector → EWS Calculator → Alert Engine → Notifications
- **Communication**: Services communicate via RESTful APIs and event-based messaging (RabbitMQ)
- **Documentation**: Swagger documentation available for all APIs

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- MongoDB (v4+)
- RabbitMQ (for production environment)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd medical-alert-system
```

2. Install dependencies for each service:
```bash
# For each service directory
cd <service-directory>
npm install
```

### Environment Configuration

Create `.env` files for each service with the following variables:

#### Data Collector Service (.env)
```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/data-collector
LOG_LEVEL=info
EWS_SERVICE_URL=http://localhost:3001
ALERT_SERVICE_URL=http://localhost:3002
```

#### EWS Service (.env)
```
PORT=3001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ews-calculator
LOG_LEVEL=info
AMQP_URL=amqp://guest:guest@localhost:5672
ALERT_SERVICE_URL=http://localhost:3002
```

#### Alert Engine Service (.env)
```
PORT=3002
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/alert-engine
LOG_LEVEL=info
AMQP_URL=amqp://guest:guest@localhost:5672
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
SMS_PROVIDER_SID=your-twilio-sid
SMS_PROVIDER_TOKEN=your-twilio-token
SMS_PROVIDER_PHONE=your-twilio-phone
```

### Running the Services

Start each service:

```bash
# From each service directory
npm run dev  # For development with auto-reload
# or
npm start    # For production
```

Access the Swagger documentation:
- Data Collector Service: http://localhost:3000/api-docs
- EWS Service: http://localhost:3001/api-docs
- Alert Engine Service: http://localhost:3002/api-docs

## Features

- Collection of medical sensor data with consensus algorithms
- Early Warning Score calculation based on vital signs
- Alert generation based on EWS scores and sensor data
- Alert notification via Email, SMS, and mobile push notifications
- Subscription management for different alert types
- Health monitoring endpoints for all services
- Comprehensive API documentation
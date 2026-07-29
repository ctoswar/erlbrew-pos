# Erlbrew POS - Project Index

## 📋 Core Documentation

### Architecture
- [[Architecture Overview]] - System design and component relationships
- [[Frontend Architecture]] - React/Vite structure and component hierarchy
- [[Backend Architecture]] - Express API routes and middleware
- [[Database Schema]] - MySQL tables and relationships

### Features
- [[Receipt Printing]] - 57mm, 58mm, and 80mm thermal printer support
- [[Timekeeping System]] - Clock in/out with time adjustment
- [[Point of Sale]] - Order management and payment processing
- [[Admin Dashboard]] - Analytics and system management

### Setup & Deployment
- [[Environment Setup]] - Installation and configuration
- [[Database Setup]] - MySQL initialization and seeding
- [[Google Sheets Integration]] - Orders sync to Sheets

### Development
- [[API Reference]] - REST endpoints documentation
- [[Field Mapping]] - snake_case ↔ camelCase conversions
- [[Error Handling]] - Common errors and solutions
- [[Testing]] - Test procedures and validation

## 🔗 Graph Visualization
- See `.graph/architecture.json` for project dependency graph

## 📁 Project Structure
```
erlbrew-pos/
├── src/                  # Frontend (React/Vite)
│   ├── components/       # React components
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   └── types/            # TypeScript definitions
├── server/               # Backend (Express)
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── db/           # Database setup
│   │   └── index.js      # Entry point
│   └── .env              # Configuration
├── docs/                 # Documentation vault
└── .mcp-config.json      # MCP server configuration
```

## 🚀 Quick Start
1. Frontend: `npm run dev` (port 3000)
2. Backend: `node server/src/index.js` (port 3001)
3. Access: https://localhost:3000

## 👥 Team Members
- Jane Dela Cruz (RFID: RF001)
- Marco Santos (RFID: RF002)
- Ana Reyes (RFID: RF003)
- Luis Garcia (RFID: RF004)

## 📊 Recent Changes
- ✅ Added 57mm receipt size support
- ✅ Implemented time adjustment system with audit trail
- ✅ Set up Graphify + Obsidian MCP integration

---
*Last updated: $(date)*
*MCP Servers: Graphify, Obsidian Vault*

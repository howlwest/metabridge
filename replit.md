# Facebook Ads Dashboard

## Overview

This is a full-stack web application that provides a dashboard interface for managing Facebook Ads campaigns. It offers functionality to retrieve advertising insights and manage ad set budgets through the Facebook Graph API. The application is built with a React frontend using shadcn/ui components and an Express.js backend, designed to be a simple and intuitive tool for digital marketers to monitor and adjust their Facebook advertising campaigns.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite as the build tool
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation resolvers

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Structure**: RESTful API with the following endpoints:
  - `GET /api/health` - Health check with API version info
  - `POST /api/insights` - Retrieve Facebook Ads insights data
  - `POST /api/adset_budget` - Update ad set daily budgets
- **Error Handling**: Centralized error handling middleware with proper HTTP status codes
- **Request Logging**: Custom middleware for API request/response logging

### Data Storage Solutions
- **Database**: PostgreSQL configured with Drizzle ORM
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Session Storage**: PostgreSQL-based session storage using connect-pg-simple
- **Memory Storage**: Fallback in-memory storage implementation for development

### Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL storage
- **User Schema**: Basic user model with username/password authentication
- **API Security**: Environment variable-based configuration for Facebook API tokens

### External Dependencies
- **Facebook Graph API**: Integration for retrieving advertising insights and managing ad sets
- **Neon Database**: Serverless PostgreSQL hosting solution
- **Development Tools**: 
  - Replit-specific plugins for development environment
  - TypeScript compiler with strict mode enabled
  - ESBuild for production bundling

### Key Design Decisions
- **Monorepo Structure**: Shared schema definitions between client and server in `/shared` directory
- **Type Safety**: Full TypeScript implementation with strict compiler settings
- **Component Architecture**: Atomic design pattern with reusable UI components
- **API Integration**: Centralized API client with TanStack Query for caching and error handling
- **Environment Configuration**: Environment-based configuration for different deployment stages
- **Development Experience**: Hot module replacement and error overlay for development efficiency
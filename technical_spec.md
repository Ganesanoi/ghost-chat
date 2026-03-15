# Technical Specification

## System Overview

Antigravity Chat is a real-time anonymous messaging platform with automatic data expiration.

The system will use WebSockets for live chat and a background job to delete messages after 24 hours.

## Architecture

Client (Browser)
|
Frontend Web App
|
WebSocket Server
|
Backend API
|
Database
|
Background Cleanup Service

## Tech Stack

Frontend
- HTML
- CSS
- JavaScript
- React (optional but recommended)

Backend
- Node.js
- Express.js

Realtime Communication
- Socket.IO

Database
- Redis (best for temporary data)
or
- MongoDB with TTL indexes

File Storage
- Local temporary storage
or
- MinIO / S3 compatible storage

Background Jobs
- Node Cron Job
or
- Redis TTL expiration

## Temporary User System

When a user visits the site:

1 Generate random ID

Example
user_x83jd
user_a19sk

2 Store ID in browser local storage

3 Send ID with every message

Example message object

{
	"userId": "user_x83jd",
	"message": "Hello everyone",
	"timestamp": 171000000
}

## Message Data Model

{
	messageId
	userId
	text
	emoji
	fileUrl
	createdAt
}

## Message Expiration

Two possible strategies:

Option 1 (Recommended)

Redis TTL

Messages automatically expire after 24 hours.

Option 2

MongoDB TTL index

createdAt + 24 hours → automatic deletion.

## Real-Time Messaging Flow

1 User sends message
2 Frontend sends message through WebSocket
3 Server broadcasts message to all users
4 Message stored in database with expiration

## File Upload

Files stored temporarily.

Limits:
- max file size: 10MB
- allowed types: image, gif, text

Files deleted after 24 hours.

## Security

Basic protections:

Rate Limiting
Prevent spam messages.

File Validation
Prevent malicious uploads.

Message Length Limit
Prevent abuse.

## Deployment

Recommended structure

Frontend
- Vercel
or
- Netlify

Backend
- VPS server
or
- Railway
or
- Render

Database
- Redis Cloud
or
- MongoDB Atlas

## Local Development (Linux)

Install Node

sudo apt update
sudo apt install nodejs npm

Create project

mkdir antigravity-chat
cd antigravity-chat

Initialize project

npm init -y

Install dependencies

npm install express socket.io cors multer redis

Run server

node server.js

## Scalability

Future scaling options

- Load balancer
- Redis pub/sub
- Kubernetes
- CDN for media files

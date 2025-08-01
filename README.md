# AgriSense Backend
## API for an Online AgriMarket
This repository contains the backend API for the AgriSense platform. It is a Node.js and Express.js application designed to power the AgriSense website, providing all the necessary endpoints for user management, product listings, orders, and market intelligence data.

## Core Features
User Management: Secure authentication and CRUD operations for different user roles (Farmers, Businesses, Admins).

Product & Order Management: Endpoints for creating product listings, handling shopping cart logic, and processing orders.

Market Intelligence API: A dedicated service for scraping and serving daily market price indices for various agricultural products in different regions.

E-wallet Integration: Functionality for managing user e-wallets.

## Getting Started
Follow these steps to get the backend server running on your local machine.

## Prerequisites
Before you begin, ensure you have the following installed:

Node.js & npm: The runtime and package manager for the application.

PostgreSQL: The database used for data storage.

Python: Required for the tabula.py script used in our data scraping services.

Java JDK: A dependency for the tabula-py library, which is used for parsing PDF data.

## Installation
Clone the repository: `git clone https://github.com/rusperres/agrisense-backend.git`

Install dependencies: `npm i`

Environment Variables:
The project requires specific environment variables to run.

Create a .env file in the root of the project.

Copy the contents from .env.example into your new .env file and fill in the required values.

.env.example:

Database Setup:

Create a PostgreSQL database with the name you specified in your .env file.


To build and run the server for production, use:

The API will be available at http://localhost:5000 (or the port you configured).

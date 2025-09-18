# Medical Waitlist Management System - An Agentic AI Solution

**Project for the Google Hackathon.**

This project introduces an automated, agentic medical waitlist system designed to optimise the patient appointment scheduling process. By leveraging AI-powered agents, we aim to reduce administrative overhead, minimise wait times, and ensure that patients are matched to the most suitable appointments based on clinical urgency and personal preferences.

## 🎯 The Problem

Healthcare providers often struggle with managing long waitlists for specialist appointments. The manual process of triaging patients based on referral notes and then matching them with available slots is time-consuming, prone to error, and can lead to suboptimal outcomes for patients. This administrative burden takes valuable time away from patient care and patient preferences are often ignored in this process.

## ✨ Our Solution

Our solution is a multi-component system that automates and enhances the waitlist management process:

1.  **AI-Powered Clinical Assessment:** An AI agent analyses patient referral data including current and previous medical history to score clinical urgency, condition severity, and the impact of comorbidities, allowing staff to prioritise the most critical cases automatically.   
2.  **Intelligent Preference Matching:** A second AI agent ranks patients for available appointments by matching their stated preferences (e.g., location, time, doctor gender, accessibility needs) with the appointment's characteristics.
3.  **Intuitive Web Interface:** A modern, responsive web application for hospital administrators to view the prioritized waitlist, manage appointments, and oversee the automated matching process. 
4.  **Automated Google Cloud Scheduling:** The system is designed for deployment on Google Cloud, leveraging services like BigQuery for data storage and Cloud Scheduler for automating hourly appointment matching.
   
## 🌟 Key Features

*   **Automated Patient Triage:** The `Clinical Grader` agent ingests patient data and outputs urgency scores with justifications - we do not score sensitive personal patient details to ensure confidentiality.
*   **Preference-Based Ranking:** The `Preferences Ranker` agent intelligently matches patients to appointments, considering a wide range of preferences, we also consider proximity to the hospital for appointments within 24 hours and time on the waiting list (first prioritising >10 weeks, then >4 weeks).
*   **Comprehensive Dashboard:** The frontend provides a clear overview of key metrics, including the number of patients on the waitlist and upcoming appointments.
*   **Waitlist & Appointment Management:** Full CRUD functionality for managing patients on the waitlist and scheduling appointments.
*   **Secure Authentication:** The system can be secured with user authentication to protect patient data.
*   **Scalable Architecture:** Built with a modern, scalable stack ready for deployment on cloud infrastructure.

## 🏗️ System Architecture

The system is composed of three core components that work in concert:

*   **Frontend:** A Next.js, React, and TypeScript application provides a responsive and user-friendly interface for hospital staff. It communicates with the middleware via a REST API.
*   **Middleware:** A FastAPI (Python) backend that serves as the central hub. It handles business logic, manages data in a BigQuery database, and communicates with the AI agents.
*   **AI Agents:** A set of Python-based agents built using Google's Agent Development Kit (ADK). These agents perform the core intelligent tasks of clinical grading and preference ranking and are designed for deployment on Google Cloud.


## 🛠️ Setup and Installation

To get the full system running locally, you will need to set up each component (Frontend, Middleware, and Agents) as well as the Google Cloud environment.

### Prerequisites

*   Python 3.11+
*   Node.js and npm (or yarn/pnpm)
*   Google Cloud SDK installed and authenticated (`gcloud auth application-default login`)
*   A Google Cloud Project with BigQuery and Secret Manager APIs enabled.

### 1. Middleware Setup

```bash
# Navigate to the middleware directory
cd middleware

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

### 2. Agents Setup

```bash
# Navigate to the agents directory
cd ../agents

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
cp .env.example .env
```

### 3. Frontend Setup

```bash
# Navigate to the frontend directory
cd ../frontend

# Install dependencies
npm install
```

Additionally, update the API endpoint in `frontend/src/lib/api.ts` to point to your local middleware server (default: `http://localhost:8000`) and your Firebase configuration in `frontend/src/lib/firebase.ts`.

### 4. Google Cloud Setup
1.  **BigQuery:** Create a BigQuery dataset and tables for storing patient and appointment data. Use the provided SQL schema in the `middleware` directory (`/middleware/bq-schema.txt`).
2.  **Secret Manager:** Store sensitive information such as database credentials and API keys in Google Cloud Secret Manager.
3.  **Cloud Scheduler:** Set up Cloud Scheduler jobs to trigger the agents at regular intervals (e.g., hourly) to process new referrals and match patients to appointments.
4.  **Firebase:** Set up a Firebase project for authentication. Update the Firebase configuration in `frontend/src/lib/firebase.ts` with your project's details.
5.  **IAM Roles:** Ensure that the necessary IAM roles are assigned to the service accounts used by the middleware and agents for accessing BigQuery and other Google Cloud resources.

## 🚀 Running the Application

### 1. Start the Middleware API

```bash
# In the /middleware directory with venv activated
fastapi dev main.py
```
The API will be available at `http://127.0.0.1:8000`.

### 2. Start the AI Agents Server

```bash
# In the /agents directory with venv activated
adk api_server
```
The agent server will also run on `http://127.0.0.1:8000`. To avoid port conflicts, you can run it on a different port:
```bash
# (Remember to update the middleware .env to point to this new agent URL)
adk api_server --port 8001
```

### 3. Start the Frontend Application

```bash
# In the /frontend directory
npm run dev
```
The web application will be available at `http://localhost:3000`.

## ☁️ Deployment

*   **Agents:** The `deploy.py` script in the `agents` directory is configured to deploy the agents to Google Cloud's Agent Engine.
*   **Middleware:** The FastAPI application is configured for deployment to App Engine.
*   **Frontend:** The Next.js application can be easily deployed through Firebase App Hosting.

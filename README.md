# Raseed Backend

This is the backend for Raseed, an AI-powered receipt assistant that integrates with Google Wallet. It allows users to upload receipts (as images or videos), automatically extracts and categorizes the data, and provides insights into their spending.

## Features

*   **Receipt Processing:** Extracts data from uploaded receipt images and videos using Google Cloud Vision and Document AI.
*   **Manual Entry:** Allows for manual input of receipt data.
*   **Data Categorization:** Automatically categorizes spending based on the extracted receipt information.
*   **User Authentication:** Secure user login and authentication using Google Sign-In.
*   **Dashboard:** Provides a dashboard to visualize spending data with various filtering options.
*   **Google Wallet Integration:** Creates a pass in Google Wallet for each saved receipt.
*   **AI-Powered Chat:** A chat interface to query spending data using natural language.
*   **Push Notifications:** Sends notifications to users.

## Getting Started

### Prerequisites

*   Node.js and npm
*   A Google Cloud project with the following APIs enabled:
    *   Cloud Vision API
    *   Document AI API
    *   Vertex AI API
    *   Google Wallet API
*   Firebase project for database and authentication.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    ```
2.  Install the dependencies:
    ```bash
    npm install
    ```
3.  Set up your environment variables by creating a `.env` file in the root of the project. You will need to add your Google Cloud and Firebase credentials, as well as a JWT secret.
4.  Start the development server:
    ```bash
    npm run dev
    ```

## API Endpoints

The following are the main API endpoints available:

*   `POST /api/google`: Handles Google Sign-In and user authentication.
*   `POST /api/upload-extract`: Uploads a receipt image or video, extracts the data, and returns the categorized information.
*   `POST /api/add_manual_receipt`: Adds a receipt with manually entered data.
*   `POST /api/save-receipt`: Saves a processed receipt to the database and creates a Google Wallet pass.
*   `GET /api/receipts`: Retrieves a list of receipts with filtering and sorting options.
*   `GET /api/dashboard`: Returns data for the user's spending dashboard.
*   `POST /api/user-queries`: Handles user queries for the AI-powered chat.
*   `POST /api/vertex`: A direct endpoint to interact with the Vertex AI.
*   `POST /api/v1/notification/send-push`: Sends a push notification.

## Technologies Used

*   **Framework:** [Fastify](https://www.fastify.io/)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Database:** [Firebase Firestore](https://firebase.google.com/docs/firestore)
*   **Authentication:** [Firebase Authentication](https://firebase.google.com/docs/auth), [Google Sign-In](https://developers.google.com/identity/sign-in/web/sign-in)
*   **AI & Machine Learning:**
    *   [Google Cloud Vision API](https://cloud.google.com/vision)
    *   [Google Cloud Document AI API](https://cloud.google.com/document-ai)
    *   [Google Cloud Vertex AI](https://cloud.google.com/vertex-ai)
*   **Google Wallet Integration:** [Google Wallet API](https://developers.google.com/wallet)
*   **Other:**
    *   [FFmpeg](https://ffmpeg.org/) for video processing
    *   [ElevenLabs](https://elevenlabs.io/) for text-to-speech
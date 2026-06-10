# Payment Feature Setup Guide

## Overview
The payment feature allows companies to approve student submissions and process payments with automatic commission splitting:
- **Platform Commission**: 10% of total amount
- **Student Receives**: 90% of total amount

## Setup Requirements

### 1. Stripe Configuration
You need to set up Stripe to process payments:

1. **Create a Stripe Account**:
   - Go to https://stripe.com and sign up
   - Get your API keys from the Stripe Dashboard

2. **Set Environment Variables**:
   Create a `.env` file in the project root:
   ```
   STRIPE_SECRET_KEY=sk_test_your_actual_secret_key
   STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_publishable_key
   ```

3. **Update server.cjs**:
   The Stripe secret key is currently set to a placeholder. Update line 6:
   ```javascript
   const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_your_actual_secret_key');
   ```

### 2. Firebase Admin SDK Configuration
The backend server uses Firebase Admin SDK for database operations:

1. **Download Service Account Key**:
   - Go to Firebase Console → Project Settings → Service Accounts
   - Click "Generate new private key"
   - Save the JSON file as `firebase-service-account.json` in the project root

2. **Update firebase-service-account.json**:
   Replace the placeholder values with your actual Firebase service account credentials

### 3. Start the Backend Server
The payment API endpoints run on the Express server:

```bash
node server.cjs
```

The server should be running on `http://localhost:3001`

## Payment Flow

### For Companies:
1. View student submissions in the Company Dashboard
2. Click "Approve & Pay" on a submission
3. Review payment breakdown (10% platform fee, 90% to student)
4. Confirm payment to process

### For Students:
1. Complete and submit tasks
2. Wait for company approval
3. View payment history in Student Dashboard
4. See breakdown of earnings (amount received, platform fee)

## API Endpoints

### Create Payment Intent
```
POST /api/payments/create-intent
Body: {
  submissionId: string,
  taskId: string,
  companyId: string,
  studentId: string,
  amount: number
}
```

### Confirm Payment
```
POST /api/payments/confirm
Body: {
  paymentIntentId: string,
  submissionId: string,
  taskId: string,
  companyId: string,
  studentId: string,
  studentName: string,
  studentEmail: string,
  companyName: string,
  taskTitle: string,
  totalAmount: number,
  platformCommission: number,
  studentAmount: number
}
```

### Get Payment History
```
GET /api/payments/history/:userId?userType=student|company
```

### Get Approval Status
```
GET /api/approvals/submission/:submissionId
```

## Database Collections

### payments
Stores all payment transactions with commission details

### task_approvals
Tracks approval status of submissions

## Testing

1. Start the backend server: `node server.cjs`
2. Start the frontend: `npm run dev`
3. Log in as a company user
4. View submissions and test the approval/payment flow
5. Check payment history in both Company and Student dashboards

## Important Notes

- The current implementation uses simulated payment confirmation
- For production, integrate Stripe Elements for secure payment processing
- Commission rate is set to 10% (can be changed in `server.cjs` line 30)
- All amounts are stored in cents for Stripe compatibility
- Platform commission is automatically calculated and tracked

## Security Considerations

- Never commit `firebase-service-account.json` to version control
- Use environment variables for sensitive keys
- Implement proper authentication for payment endpoints
- Add webhook handling for Stripe events in production

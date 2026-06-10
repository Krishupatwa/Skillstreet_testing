# Payment System Database Schema

## Collections

### payments
Tracks all payment transactions with commission splitting

```javascript
{
  id: string,
  taskId: string,
  taskTitle: string,
  submissionId: string,
  companyId: string,
  companyName: string,
  studentId: string,
  studentName: string,
  studentEmail: string,
  
  // Payment amounts (in cents for Stripe)
  totalAmount: number, // Total task prize
  platformCommission: number, // Platform fee (e.g., 10%)
  studentAmount: number, // Amount sent to student
  
  // Payment status
  status: 'pending' | 'processing' | 'completed' | 'failed',
  
  // Stripe details
  stripePaymentIntentId: string,
  stripeTransferId: string, // Transfer to student
  
  // Timestamps
  createdAt: timestamp,
  completedAt: timestamp,
  
  // Commission rate (percentage)
  commissionRate: number // e.g., 10 for 10%
}
```

### task_approvals
Tracks company approval of student submissions

```javascript
{
  id: string,
  taskId: string,
  submissionId: string,
  companyId: string,
  studentId: string,
  
  // Approval details
  approved: boolean,
  approvedAt: timestamp,
  approvedBy: string, // Company user ID
  
  // Payment trigger
  paymentTriggered: boolean,
  paymentId: string, // Reference to payments collection
  
  // Feedback
  companyFeedback: string,
  
  createdAt: timestamp
}
```

## Payment Flow

1. Company approves a student submission
2. System creates task_approvals document
3. System initiates Stripe payment:
   - Company pays total amount
   - Platform commission is deducted
   - Remaining amount is transferred to student
4. Payment record is created in payments collection
5. Both company and student can view payment history

## Commission Structure

- Default commission: 10% of total amount
- Platform receives: totalAmount * commissionRate / 100
- Student receives: totalAmount - platformCommission

## Example

For a ₹1500 task:
- Total amount: ₹1500 (150000 cents)
- Platform commission (10%): ₹150 (15000 cents)
- Student receives: ₹1350 (135000 cents)

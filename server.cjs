const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key');

// Firebase Admin - for payments/approvals only
let db = null;
let admin = null;
try {
  admin = require('firebase-admin');
  const serviceAccount = require('./firebase-service-account.json');

  if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: 'skillstreetofficial'
    });
  }

  db = admin.firestore();
  console.log('Firebase Admin initialized successfully');
} catch (error) {
  console.warn('Firebase Admin not configured - payment features will be limited:', error.message);
}

const app = express();

// Local file storage configuration
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  console.log('Created uploads directory:', UPLOADS_DIR);
}

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: MAX_FILE_SIZE }
});

const METADATA_FILE = path.join(UPLOADS_DIR, 'uploads-metadata.json');

const COMMISSION_RATE = 10;

const readLocalMetadata = () => {
  try {
    if (fs.existsSync(METADATA_FILE)) {
      const raw = fs.readFileSync(METADATA_FILE, 'utf8');
      return JSON.parse(raw || '[]');
    }
  } catch (error) {
    console.warn('Failed to read local metadata file:', error.message);
  }
  return [];
};

const writeLocalMetadata = (records) => {
  try {
    fs.writeFileSync(METADATA_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to write local metadata file:', error.message);
  }
};

const persistFileMetadata = async (fileData) => {
  if (db) {
    try {
      const docRef = await db.collection('files').add(fileData);
      return { id: docRef.id, ...fileData };
    } catch (error) {
      console.warn('Firestore write failed, falling back to local metadata:', error.message);
    }
  }

  const existing = readLocalMetadata();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const record = { id, ...fileData };
  existing.push(record);
  writeLocalMetadata(existing);
  return record;
};

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files as static files
app.use('/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
    firebaseConfigured: db !== null,
    fileStorageActive: true,
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'Skill Street Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      upload: 'POST /api/files/upload',
      list: 'GET /api/files/list',
      download: 'GET /api/files/download/:fileId',
      view: 'GET /api/files/view/:fileId',
      delete: 'DELETE /api/files/:fileId',
      payments: '/api/payments/*',
      approvals: '/api/approvals/*'
    }
  });
});

// Upload file (community file manager)
app.post('/api/files/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { uploadedBy, description } = req.body;
    const fileData = {
      originalName: req.file.originalname,
      savedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: uploadedBy || 'anonymous',
      description: description || '',
      uploadedAt: new Date().toISOString(),
      fileUrl: `/uploads/${req.file.filename}`,
      downloads: 0
    };

    const persisted = await persistFileMetadata(fileData);

    res.json({
      success: true,
      id: persisted.id,
      ...fileData
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});

// Upload alias for Student submission modal
// Student.jsx calls POST /api/upload (with field name: `file`).
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { uploadedBy, description } = req.body;
    const fileData = {
      originalName: req.file.originalname,
      savedName: req.file.filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: uploadedBy || 'anonymous',
      description: description || '',
      uploadedAt: new Date().toISOString(),
      fileUrl: `/uploads/${req.file.filename}`,
      downloads: 0
    };

    const persisted = await persistFileMetadata(fileData);

    // Keep response shape compatible with Student.jsx expectations

    res.json({
      success: true,
      fileId: persisted.id,
      bucketId: 'local',
      fileUrl: `/uploads/${req.file.filename}`,
      ...fileData
    });
  } catch (error) {
    console.error('Student upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
});


// List all files
app.get('/api/files/list', async (req, res) => {
  try {
    let files = [];

    if (db) {
      try {
        const filesCollection = db.collection('files');
        const querySnapshot = await filesCollection.get();
        files = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }));
      } catch (error) {
        console.warn('Firestore list failed, falling back to local metadata:', error.message);
        files = readLocalMetadata();
      }
    } else {
      files = readLocalMetadata();
    }

    files = files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    res.json({ success: true, count: files.length, files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files', details: error.message });
  }
});

// Download file
// IMPORTANT: Always stream from local `uploads/`.
// This avoids any Firebase/Google auth issues (e.g. 16 UNAUTHENTICATED) during downloads.
app.get('/api/files/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    // Prefer local metadata (works with local uploads-metadata.json)
    const allFiles = readLocalMetadata();
    const fileData = allFiles.find((record) => record.id === fileId);

    if (!fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(UPLOADS_DIR, fileData.savedName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Best-effort downloads counter (never blocks download)
    try {
      if (db) {
        await db.collection('files').doc(fileId).update({
          downloads: (fileData.downloads || 0) + 1
        });
      }
    } catch (e) {
      // ignore
    }

    res.setHeader('Content-Disposition', `attachment; filename="${fileData.originalName}"`);
    res.setHeader('Content-Type', fileData.mimeType || 'application/octet-stream');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file', details: error.message });
  }
});

// View file metadata
app.get('/api/files/view/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    if (db) {
      const fileDoc = await db.collection('files').doc(fileId).get();
      if (!fileDoc.exists) {
        return res.status(404).json({ error: 'File not found' });
      }
      return res.json({ id: fileDoc.id, ...fileDoc.data() });
    }

    const allFiles = readLocalMetadata();
    const fileData = allFiles.find((record) => record.id === fileId);
    if (!fileData) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json(fileData);
  } catch (error) {
    console.error('View file error:', error);
    res.status(500).json({ error: 'Failed to get file metadata', details: error.message });
  }
});

// Download link helper for student/company pages
app.get('/api/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    if (db) {
      const fileDoc = await db.collection('files').doc(fileId).get();
      if (!fileDoc.exists) {
        return res.status(404).json({ error: 'File not found' });
      }
    } else {
      const allFiles = readLocalMetadata();
      const fileData = allFiles.find((record) => record.id === fileId);
      if (!fileData) {
        return res.status(404).json({ error: 'File not found' });
      }
    }

    res.json({
      downloadUrl: `/api/files/download/${fileId}`
    });
  } catch (error) {
    console.error('Download alias error:', error);
    res.status(500).json({ error: 'Failed to resolve download link', details: error.message });
  }
});

// Delete file
app.delete('/api/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    let fileData = null;

    if (db) {
      const fileDoc = await db.collection('files').doc(fileId).get();
      if (!fileDoc.exists) {
        return res.status(404).json({ error: 'File not found' });
      }
      fileData = fileDoc.data();
    } else {
      const allFiles = readLocalMetadata();
      const recordIndex = allFiles.findIndex((record) => record.id === fileId);
      if (recordIndex === -1) {
        return res.status(404).json({ error: 'File not found' });
      }
      fileData = allFiles[recordIndex];
      allFiles.splice(recordIndex, 1);
      writeLocalMetadata(allFiles);
    }

    const filePath = path.join(UPLOADS_DIR, fileData.savedName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    if (db) {
      await db.collection('files').doc(fileId).delete();
    }

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file', details: error.message });
  }
});

// Payment API Endpoints
app.post('/api/payments/create-intent', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured - payment features unavailable' });
    }

    const { submissionId, taskId, companyId, studentId, amount } = req.body;

    if (!submissionId || !taskId || !companyId || !studentId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);
    const platformCommission = Math.round(amountInCents * (COMMISSION_RATE / 100));
    const studentAmount = amountInCents - platformCommission;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'inr',
      metadata: {
        submissionId,
        taskId,
        companyId,
        studentId,
        platformCommission: platformCommission.toString(),
        studentAmount: studentAmount.toString()
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
      platformCommission,
      studentAmount
    });
  } catch (error) {
    console.error('Payment intent creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/payments/confirm', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured - payment features unavailable' });
    }

    const { paymentIntentId, submissionId, taskId, companyId, studentId, studentName, studentEmail, companyName, taskTitle, totalAmount, platformCommission, studentAmount } = req.body;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    const paymentData = {
      taskId,
      taskTitle,
      submissionId,
      companyId,
      companyName,
      studentId,
      studentName,
      studentEmail,
      totalAmount: parseInt(totalAmount, 10),
      platformCommission: parseInt(platformCommission, 10),
      studentAmount: parseInt(studentAmount, 10),
      status: 'completed',
      stripePaymentIntentId: paymentIntentId,
      commissionRate: COMMISSION_RATE,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };

    const paymentRef = await db.collection('payments').add(paymentData);



    await db.collection('submissions').doc(submissionId).update({
      paymentId: paymentRef.id,
      paymentStatus: 'completed',
      paidAt: new Date().toISOString()
    });

    const approvalData = {
      taskId,
      submissionId,
      companyId,
      studentId,
      approved: true,
      approvedAt: new Date().toISOString(),
      approvedBy: companyId,
      paymentTriggered: true,
      paymentId: paymentRef.id,
      createdAt: new Date().toISOString()
    };

    await db.collection('task_approvals').add(approvalData);


    res.json({ success: true, paymentId: paymentRef.id, message: 'Payment processed successfully' });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payments/history/:userId', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured - payment features unavailable' });
    }

    const { userId } = req.params;
    const { userType } = req.query;

    let paymentsQuery;
    if (userType === 'student') {
      paymentsQuery = db.collection('payments').where('studentId', '==', userId);
    } else if (userType === 'company') {
      paymentsQuery = db.collection('payments').where('companyId', '==', userId);
    } else {
      return res.status(400).json({ error: 'Invalid user type' });
    }


    const querySnapshot = await paymentsQuery.get();
    const payments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    res.json({ payments });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/approvals/submission/:submissionId', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Firebase not configured - payment features unavailable' });
    }

    const { submissionId } = req.params;
    const approvalQuery = db.collection('task_approvals').where('submissionId', '==', submissionId);


    const querySnapshot = await approvalQuery.get();

    if (querySnapshot.empty) {
      return res.json({ approved: false });
    }

    const approval = querySnapshot.docs[0].data();
    res.json({ approved: approval.approved, approval });
  } catch (error) {
    console.error('Approval status error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 File uploads directory: ${UPLOADS_DIR}`);
  console.log(`📊 Max file size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

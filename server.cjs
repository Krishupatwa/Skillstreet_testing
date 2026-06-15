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

// Hostinger/local file storage configuration.
// Files are stored directly on the Node.js server disk and served by Express.
const STORAGE_FOLDERS = ['uploads', 'designs', 'files'];
const STORAGE_ROOTS = STORAGE_FOLDERS.reduce((roots, folder) => {
  roots[folder] = path.join(__dirname, folder);
  return roots;
}, {});
const UPLOADS_DIR = STORAGE_ROOTS.uploads;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Ensure local storage directories exist
for (const folder of STORAGE_FOLDERS) {
  if (!fs.existsSync(STORAGE_ROOTS[folder])) {
    fs.mkdirSync(STORAGE_ROOTS[folder], { recursive: true });
    console.log('Created storage directory:', STORAGE_ROOTS[folder]);
  }
}

const resolveStorageFolder = (folder, fallback = 'files') => {
  return STORAGE_FOLDERS.includes(folder) ? folder : fallback;
};

const getMetadataFile = (folder) => {
  return path.join(STORAGE_ROOTS[folder], `${folder}-metadata.json`);
};

// Configure multer for local file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = resolveStorageFolder(req.params.folder || req.body.folder, req.defaultStorageFolder || 'files');
    req.storageFolder = folder;
    cb(null, STORAGE_ROOTS[folder]);
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

const COMMISSION_RATE = 10;

const readLocalMetadata = (folder = 'files') => {
  try {
    const metadataFile = getMetadataFile(folder);
    if (fs.existsSync(metadataFile)) {
      const raw = fs.readFileSync(metadataFile, 'utf8');
      return JSON.parse(raw || '[]');
    }
  } catch (error) {
    console.warn(`Failed to read ${folder} metadata file:`, error.message);
  }
  return [];
};

const writeLocalMetadata = (records, folder = 'files') => {
  try {
    fs.writeFileSync(getMetadataFile(folder), JSON.stringify(records, null, 2), 'utf8');
  } catch (error) {
    console.error(`Failed to write ${folder} metadata file:`, error.message);
  }
};

const readAllLocalMetadata = () => {
  return STORAGE_FOLDERS.flatMap((folder) => {
    return readLocalMetadata(folder).map((record) => ({
      folder,
      ...record,
      folder: record.folder || folder
    }));
  });
};

const findLocalFileRecord = (fileId) => {
  for (const folder of STORAGE_FOLDERS) {
    const records = readLocalMetadata(folder);
    const index = records.findIndex((record) => record.id === fileId);
    if (index !== -1) {
      return { folder, records, index, fileData: { folder, ...records[index] } };
    }
  }

  return null;
};

const persistFileMetadata = async (fileData, folder = 'files') => {
  const existing = readLocalMetadata(folder);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const record = { id, folder, ...fileData };
  existing.push(record);
  writeLocalMetadata(existing, folder);
  return record;
};

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local storage folders as static files.
for (const folder of STORAGE_FOLDERS) {
  app.use(`/${folder}`, express.static(STORAGE_ROOTS[folder]));
}

const getPublicBaseUrl = (req) => {
  if (process.env.PUBLIC_BASE_URL) {
    return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  }

  return `${req.protocol}://${req.get('host')}`;
};

const createFileRecordFromUpload = (req, folder) => {
  return {
    originalName: req.file.originalname,
    savedName: req.file.filename,
    folder,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.body.uploadedBy || 'anonymous',
    description: req.body.description || '',
    uploadedAt: new Date().toISOString(),
    fileUrl: `/${folder}/${req.file.filename}`,
    downloads: 0
  };
};

const handleLocalUpload = async (req, res, fallbackFolder = 'files') => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const folder = req.storageFolder || resolveStorageFolder(req.params.folder || req.body.folder, fallbackFolder);
    const fileData = createFileRecordFromUpload(req, folder);
    const persisted = await persistFileMetadata(fileData, folder);

    res.json({
      success: true,
      id: persisted.id,
      fileId: persisted.id,
      bucketId: 'local',
      storage: 'hostinger-local',
      downloadUrl: `${getPublicBaseUrl(req)}/api/files/download/${persisted.id}`,
      ...fileData
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
};

const handleUploadError = (fallbackFolder = 'files') => {
  return (req, res, next) => {
    req.defaultStorageFolder = fallbackFolder;
    upload.single('file')(req, res, (error) => {
      if (!error) {
        return next();
      }

      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` });
      }

      console.error('Multer upload error:', error);
      return res.status(400).json({ error: 'Upload failed', details: error.message });
    });
  };
};

const downloadLocalFile = (req, res) => {
  try {
    const { fileId } = req.params;
    const match = findLocalFileRecord(fileId);

    if (!match) {
      return res.status(404).json({ error: 'File not found' });
    }

    const { folder, records, index, fileData } = match;
    const filePath = path.join(STORAGE_ROOTS[folder], fileData.savedName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    records[index] = {
      ...records[index],
      downloads: (records[index].downloads || 0) + 1
    };
    writeLocalMetadata(records, folder);

    res.download(filePath, fileData.originalName);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download file', details: error.message });
  }
};

const viewLocalFile = (req, res) => {
  try {
    const { fileId } = req.params;
    const match = findLocalFileRecord(fileId);

    if (!match) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(STORAGE_ROOTS[match.folder], match.fileData.savedName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    res.setHeader('Content-Type', match.fileData.mimeType || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('View file error:', error);
    res.status(500).json({ error: 'Failed to view file', details: error.message });
  }
};

const deleteLocalFile = (req, res) => {
  try {
    const { fileId } = req.params;
    const match = findLocalFileRecord(fileId);

    if (!match) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(STORAGE_ROOTS[match.folder], match.fileData.savedName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    match.records.splice(match.index, 1);
    writeLocalMetadata(match.records, match.folder);

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: 'Failed to delete file', details: error.message });
  }
};

const listLocalFiles = (folder) => {
  const files = folder ? readLocalMetadata(folder) : readAllLocalMetadata();
  return files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
};

const storageRouter = express.Router({ mergeParams: true });

storageRouter.post('/:folder/upload', handleUploadError(), (req, res) => handleLocalUpload(req, res));
storageRouter.get('/:folder/list', (req, res) => {
  const folder = resolveStorageFolder(req.params.folder);
  const files = listLocalFiles(folder);
  res.json({ success: true, storage: 'hostinger-local', folder, count: files.length, files });
});

storageRouter.get('/list', (req, res) => {
  const files = listLocalFiles();
  res.json({ success: true, storage: 'hostinger-local', count: files.length, files });
});

storageRouter.get('/download/:fileId', downloadLocalFile);
storageRouter.get('/view/:fileId', viewLocalFile);
storageRouter.delete('/:fileId', deleteLocalFile);

app.use('/api/storage', storageRouter);


app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Backend is running',
    firebaseConfigured: db !== null,
    fileStorageActive: true,
    storageMode: 'hostinger-local',
    storageFolders: STORAGE_FOLDERS,
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
      storageUpload: 'POST /api/storage/:folder/upload',
      storageList: 'GET /api/storage/:folder/list',
      storageDownload: 'GET /api/storage/download/:fileId',
      payments: '/api/payments/*',
      approvals: '/api/approvals/*'
    }
  });
});

// Upload file (community file manager)
app.post('/api/files/upload', handleUploadError('files'), (req, res) => handleLocalUpload(req, res, 'files'));

// Upload alias for Student submission modal
// Student.jsx calls POST /api/upload (with field name: `file`).
app.post('/api/upload', handleUploadError('uploads'), (req, res) => handleLocalUpload(req, res, 'uploads'));


// List all files
app.get('/api/files/list', async (req, res) => {
  try {
    const files = listLocalFiles();
    res.json({ success: true, count: files.length, files });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Failed to list files', details: error.message });
  }
});

// Download file
app.get('/api/files/download/:fileId', downloadLocalFile);

// View file metadata
app.get('/api/files/view/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const match = findLocalFileRecord(fileId);
    if (!match) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json(match.fileData);
  } catch (error) {
    console.error('View file error:', error);
    res.status(500).json({ error: 'Failed to get file metadata', details: error.message });
  }
});

// Download link helper for student/company pages
app.get('/api/download/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;

    const match = findLocalFileRecord(fileId);
    if (!match) {
      return res.status(404).json({ error: 'File not found' });
    }

    res.json({
      downloadUrl: `${getPublicBaseUrl(req)}/api/files/download/${fileId}`
    });
  } catch (error) {
    console.error('Download alias error:', error);
    res.status(500).json({ error: 'Failed to resolve download link', details: error.message });
  }
});

// Delete file
app.delete('/api/files/:fileId', deleteLocalFile);

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
  console.log(`📁 Storage directories: ${STORAGE_FOLDERS.map((folder) => STORAGE_ROOTS[folder]).join(', ')}`);
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

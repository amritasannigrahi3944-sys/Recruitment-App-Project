const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * IMPORTANT:
 * This MUST match Helm values.yaml
 * env:
 *   MONGODB_URI: mongodb://admin:password@mongodb-service:27017/recruitmentdb?authSource=admin
 */
const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = 'recruitmentdb';

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI is not set');
  process.exit(1);
}

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ================= HR KNOWLEDGE BASE ================= */

const hrKnowledgeBase = {
  'leave policy': 'Employees are entitled to 12 days of casual leave, 10 days of sick leave, and 15 days of annual leave per year.',
  'attendance policy': 'Standard working hours are 9 AM to 6 PM.',
  'holidays': 'Public holidays include New Year, Independence Day, Diwali, and Christmas.',
  'grievance procedure': 'Grievances are reviewed within 3 business days.',
  'salary policy': 'Salaries are processed on the last working day of each month.',
  'dress code': 'Business casual attire is required.',
  'remote work': 'Remote work is allowed up to 2 days per week.',
  'training programs': 'Skill development programs are conducted quarterly.',
  'performance review': 'Annual performance reviews are conducted in December.',
  'benefits': 'Medical insurance, PF, and meal allowances are provided.'
};

function getChatbotResponse(query) {
  const q = query.toLowerCase();
  for (const [key, value] of Object.entries(hrKnowledgeBase)) {
    if (q.includes(key)) return value;
  }
  if (q.includes('hello') || q.includes('hi')) {
    return 'Hello! I am your HR Assistant. How can I help you today?';
  }
  if (q.includes('help')) {
    return 'You can ask about leave, attendance, holidays, grievances, salary, or benefits.';
  }
  return 'Sorry, I don’t have information on that topic.';
}

/* ================= DATABASE CONNECTION ================= */

let db;

MongoClient.connect(MONGO_URI)
  .then(client => {
    db = client.db(DB_NAME);
    console.log('✅ Connected to MongoDB');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

/* ================= AUTH APIs ================= */

app.post('/api/signup', async (req, res) => {
  const { fullName, empId, email, password } = req.body;
  if (!fullName || !empId || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  const existing = await db.collection('employees').findOne({
    $or: [{ empId }, { email }]
  });

  if (existing) {
    return res.status(409).json({ message: 'Employee already exists' });
  }

  await db.collection('employees').insertOne({
    fullName,
    empId,
    email,
    password
  });

  res.json({ message: 'Signup successful' });
});

app.post('/api/login', async (req, res) => {
  const { empId, password } = req.body;
  const user = await db.collection('employees').findOne({ empId, password });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  res.json({ message: 'Login successful' });
});

/* ================= CHATBOT ================= */

app.post('/api/chatbot', async (req, res) => {
  const { query, empId } = req.body;
  if (!query) {
    return res.status(400).json({ message: 'Query required' });
  }

  const response = getChatbotResponse(query);

  await db.collection('chat_logs').insertOne({
    empId: empId || 'anonymous',
    query,
    response,
    timestamp: new Date()
  });

  res.json({ response });
});

/* ================= LEAVE ================= */

app.post('/api/leave/apply', async (req, res) => {
  const { empId, startDate, endDate, leaveReason } = req.body;
  if (!empId || !startDate || !endDate || !leaveReason) {
    return res.status(400).json({ message: 'All fields required' });
  }

  await db.collection('leave_requests').insertOne({
    empId,
    startDate,
    endDate,
    leaveReason,
    status: 'Pending',
    appliedAt: new Date()
  });

  res.json({ message: 'Leave request submitted' });
});

/* ================= BASIC HEALTH CHECK ================= */

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

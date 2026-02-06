const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

/* =======================
   MongoDB Configuration
======================= */
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error('❌ MONGODB_URI is not defined');
  process.exit(1);
}

/* =======================
   Middleware
======================= */
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

/* =======================
   HR Knowledge Base
======================= */
const hrKnowledgeBase = {
  'leave policy': 'Employees are entitled to 12 days of casual leave, 10 days of sick leave, and 15 days of annual leave per year.',
  'attendance policy': 'Standard working hours are 9 AM to 6 PM.',
  'holidays': 'Public holidays include New Year, Independence Day, Gandhi Jayanti, Diwali, and Christmas.',
  'grievance procedure': 'Grievances can be submitted through the portal and reviewed within 3 business days.',
  'salary policy': 'Salaries are processed on the last working day of each month.',
  'dress code': 'Business casual attire is required.',
  'remote work': 'Remote work allowed up to 2 days/week with approval.',
  'training programs': 'Quarterly skill development programs available.',
  'performance review': 'Annual reviews conducted in December.',
  'benefits': 'Medical insurance, PF, and meal allowances provided.'
};

function getChatbotResponse(query) {
  const q = query.toLowerCase();

  for (const [key, value] of Object.entries(hrKnowledgeBase)) {
    if (q.includes(key)) return value;
  }

  if (q.includes('hi') || q.includes('hello')) {
    return 'Hello! I am your HR Assistant. How can I help you today?';
  }

  if (q.includes('help')) {
    return 'Ask me about leave, attendance, holidays, salary, benefits, or grievance.';
  }

  return 'Sorry, I don’t have information on that topic.';
}

/* =======================
   MongoDB Connection
======================= */
let db;

(async () => {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();

    db = client.db(); // DB name comes from URI

    console.log('✅ Connected to MongoDB');
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    process.exit(1);
  }
})();

/* =======================
   AUTH APIs
======================= */
app.post('/api/signup', async (req, res) => {
  const { fullName, empId, email, password } = req.body;
  if (!fullName || !empId || !email || !password) {
    return res.status(400).json({ message: 'All fields required' });
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

/* =======================
   LEAVE MANAGEMENT
======================= */
app.post('/api/leave/apply', async (req, res) => {
  const { empId, startDate, endDate, leaveReason } = req.body;

  await db.collection('leave_requests').insertOne({
    empId,
    startDate,
    endDate,
    leaveReason,
    status: 'Pending',
    appliedAt: new Date()
  });

  res.json({ message: 'Leave applied successfully' });
});

/* =======================
   CHATBOT
======================= */
app.post('/api/chatbot', async (req, res) => {
  const { query, empId } = req.body;

  const response = getChatbotResponse(query);

  await db.collection('chat_logs').insertOne({
    empId: empId || 'anonymous',
    query,
    response,
    timestamp: new Date()
  });

  res.json({ response });
});

/* =======================
   ADMIN APIs
======================= */
app.post('/api/admin/login', async (req, res) => {
  const { adminId, password } = req.body;

  if (adminId === 'admin' && password === 'admin123') {
    return res.json({ message: 'Admin login successful' });
  }

  res.status(401).json({ message: 'Invalid admin credentials' });
});

app.get('/api/admin/employees', async (req, res) => {
  const employees = await db.collection('employees').find({}).toArray();
  const safe = employees.map(({ password, ...rest }) => rest);
  res.json(safe);
});

app.delete('/api/admin/employees/:id', async (req, res) => {
  await db.collection('employees').deleteOne({ _id: new ObjectId(req.params.id) });
  res.json({ message: 'Employee deleted' });
});

/* =======================
   ATTENDANCE
======================= */
app.post('/api/attendance/checkin', async (req, res) => {
  const { empId } = req.body;
  const today = new Date().toISOString().split('T')[0];

  await db.collection('attendance').updateOne(
    { empId, date: today },
    { $set: { checkIn: new Date().toLocaleTimeString(), status: 'Present' } },
    { upsert: true }
  );

  res.json({ message: 'Checked in' });
});

app.post('/api/attendance/checkout', async (req, res) => {
  const { empId } = req.body;
  const today = new Date().toISOString().split('T')[0];

  await db.collection('attendance').updateOne(
    { empId, date: today },
    { $set: { checkOut: new Date().toLocaleTimeString() } }
  );

  res.json({ message: 'Checked out' });
});

/* =======================
   GRIEVANCE
======================= */
app.post('/api/grievance', async (req, res) => {
  const { empId, grievanceText } = req.body;

  await db.collection('grievances').insertOne({
    empId,
    grievanceText,
    submittedAt: new Date()
  });

  res.json({ message: 'Grievance submitted' });
});

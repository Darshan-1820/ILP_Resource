const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

/* ── Env ── */
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5500";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "";

/* ── Firebase Admin Init ── */
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

/* ── Express ── */
const app = express();

app.use(cors({
  origin: [FRONTEND_URL, "http://localhost:5500", "http://127.0.0.1:5500"],
  credentials: true,
}));
app.use(express.json());

// Raw body for Razorpay webhook verification
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

/* ── Auth Middleware ── */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }
  try {
    const token = header.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

/* ── Admin Middleware ── */
function adminOnly(req, res, next) {
  if (req.user.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Admin access only" });
  }
  next();
}

/* ══════════════════════════════════════════════
   DEVICE LOCKING
   ══════════════════════════════════════════════ */

async function checkDevice(req, res, next) {
  const uid = req.user.uid;
  const deviceId = req.headers["x-device-id"];

  if (!deviceId) {
    return res.status(400).json({ error: "Device ID required" });
  }

  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data();

  if (userData && userData.activeDevice && userData.activeDevice !== deviceId) {
    return res.status(403).json({
      error: "DEVICE_CONFLICT",
      message: "Your account is active on another device. Sign out there first, or this login will replace it.",
    });
  }

  // Register this device
  await db.collection("users").doc(uid).set(
    { activeDevice: deviceId, lastActive: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );

  next();
}

/* ══════════════════════════════════════════════
   AUTH ROUTES
   ══════════════════════════════════════════════ */

// Register device on login
app.post("/api/auth/register-device", authenticate, async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) return res.status(400).json({ error: "deviceId required" });

  const uid = req.user.uid;
  const userDoc = await db.collection("users").doc(uid).get();
  const userData = userDoc.data();

  // If different device is active, force-register this one (kick old device)
  await db.collection("users").doc(uid).set(
    {
      activeDevice: deviceId,
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      email: req.user.email,
      displayName: req.user.name || req.user.email.split("@")[0],
    },
    { merge: true }
  );

  const wasConflict = userData && userData.activeDevice && userData.activeDevice !== deviceId;

  res.json({
    success: true,
    replacedDevice: wasConflict,
    message: wasConflict
      ? "Previous device session has been ended"
      : "Device registered",
  });
});

// Check if current device is still valid
app.get("/api/auth/check-device", authenticate, async (req, res) => {
  const deviceId = req.headers["x-device-id"];
  if (!deviceId) return res.status(400).json({ error: "Device ID required" });

  const userDoc = await db.collection("users").doc(req.user.uid).get();
  const userData = userDoc.data();

  if (userData && userData.activeDevice !== deviceId) {
    return res.json({ valid: false, message: "Session ended — logged in on another device" });
  }

  res.json({ valid: true });
});

/* ══════════════════════════════════════════════
   PAYMENT STATUS
   ══════════════════════════════════════════════ */

app.get("/api/user/status", authenticate, async (req, res) => {
  const userDoc = await db.collection("users").doc(req.user.uid).get();
  const userData = userDoc.data() || {};

  res.json({
    paid: userData.paid === true,
    email: req.user.email,
    displayName: userData.displayName || req.user.email.split("@")[0],
  });
});

/* ══════════════════════════════════════════════
   RAZORPAY PAYMENT
   ══════════════════════════════════════════════ */

let razorpay = null;
try {
  const Razorpay = require("razorpay");
  if (process.env.RAZORPAY_KEY_ID) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
} catch (_) {}

// Create order
app.post("/api/payment/create-order", authenticate, async (req, res) => {
  if (!razorpay) return res.status(503).json({ error: "Payments not configured yet" });

  // Check if already paid
  const userDoc = await db.collection("users").doc(req.user.uid).get();
  if (userDoc.data()?.paid) {
    return res.json({ alreadyPaid: true });
  }

  try {
    const order = await razorpay.orders.create({
      amount: 19900, // ₹199 in paise
      currency: "INR",
      receipt: `ilp_${req.user.uid}_${Date.now()}`,
      notes: {
        uid: req.user.uid,
        email: req.user.email,
      },
    });

    // Save order to Firestore
    await db.collection("orders").doc(order.id).set({
      uid: req.user.uid,
      email: req.user.email,
      amount: 199,
      status: "created",
      razorpayOrderId: order.id,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay order error:", err);
    const detail = err?.error?.description || err?.message || "Unknown error";
    res.status(500).json({ error: `Failed to create payment order: ${detail}` });
  }
});

// Verify payment (called from frontend after Razorpay checkout success)
app.post("/api/payment/verify", authenticate, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: "Missing payment details" });
  }

  // Verify signature
  const crypto = require("crypto");
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: "Payment verification failed" });
  }

  // Mark user as paid
  const uid = req.user.uid;
  await db.collection("users").doc(uid).set(
    {
      paid: true,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      razorpayPaymentId: razorpay_payment_id,
    },
    { merge: true }
  );

  // Update order
  await db.collection("orders").doc(razorpay_order_id).set(
    {
      status: "paid",
      razorpayPaymentId: razorpay_payment_id,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  res.json({ success: true, message: "Payment verified — full access granted" });
});

// Razorpay webhook (backup verification — server-to-server)
app.post("/api/payment/webhook", async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(200).send("OK");

  const crypto = require("crypto");
  const signature = req.headers["x-razorpay-signature"];
  const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(body)
    .digest("hex");

  if (signature !== expectedSig) {
    return res.status(400).send("Invalid signature");
  }

  const event = JSON.parse(body);

  if (event.event === "payment.captured") {
    const payment = event.payload.payment.entity;
    const uid = payment.notes?.uid;

    if (uid) {
      await db.collection("users").doc(uid).set(
        {
          paid: true,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          razorpayPaymentId: payment.id,
        },
        { merge: true }
      );
    }
  }

  res.status(200).send("OK");
});

/* ══════════════════════════════════════════════
   CONTENT API — serves locked content to paid users
   ══════════════════════════════════════════════ */

app.get("/api/content/:page", authenticate, async (req, res) => {
  const userDoc = await db.collection("users").doc(req.user.uid).get();
  const userData = userDoc.data() || {};

  if (!userData.paid) {
    return res.status(403).json({
      error: "PAYMENT_REQUIRED",
      message: "Pay ₹199 to unlock full content",
    });
  }

  const page = req.params.page.replace(/[^a-z0-9-]/gi, ""); // sanitize
  const contentDoc = await db.collection("content").doc(page).get();

  if (!contentDoc.exists) {
    return res.status(404).json({ error: "Page not found" });
  }

  res.json({ html: contentDoc.data().html });
});

/* ══════════════════════════════════════════════
   ADMIN ROUTES
   ══════════════════════════════════════════════ */

// Dashboard stats
app.get("/api/admin/stats", authenticate, adminOnly, async (req, res) => {
  const usersSnap = await db.collection("users").get();
  const ordersSnap = await db.collection("orders").where("status", "==", "paid").get();

  let totalUsers = 0;
  let paidUsers = 0;
  let activeToday = 0;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const signupsByDay = {};
  const revenueByDay = {};

  usersSnap.forEach((doc) => {
    const data = doc.data();
    totalUsers++;
    if (data.paid) paidUsers++;

    if (data.lastActive && data.lastActive.toDate() >= todayStart) {
      activeToday++;
    }

    // Signups by day (last 30 days)
    if (data.lastLogin) {
      const day = data.lastLogin.toDate().toISOString().split("T")[0];
      signupsByDay[day] = (signupsByDay[day] || 0) + 1;
    }
  });

  let totalRevenue = 0;
  ordersSnap.forEach((doc) => {
    const data = doc.data();
    totalRevenue += data.amount || 0;

    if (data.paidAt) {
      const day = data.paidAt.toDate().toISOString().split("T")[0];
      revenueByDay[day] = (revenueByDay[day] || 0) + (data.amount || 0);
    }
  });

  res.json({
    totalUsers,
    paidUsers,
    freeUsers: totalUsers - paidUsers,
    activeToday,
    totalRevenue,
    conversionRate: totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : 0,
    signupsByDay,
    revenueByDay,
  });
});

// User list
app.get("/api/admin/users", authenticate, adminOnly, async (req, res) => {
  const usersSnap = await db.collection("users").orderBy("lastLogin", "desc").limit(100).get();
  const users = [];

  usersSnap.forEach((doc) => {
    const data = doc.data();
    users.push({
      uid: doc.id,
      email: data.email || "—",
      displayName: data.displayName || "—",
      paid: data.paid || false,
      lastLogin: data.lastLogin?.toDate() || null,
      paidAt: data.paidAt?.toDate() || null,
      activeDevice: data.activeDevice || null,
    });
  });

  res.json({ users });
});

// Recent payments
app.get("/api/admin/payments", authenticate, adminOnly, async (req, res) => {
  const ordersSnap = await db.collection("orders")
    .where("status", "==", "paid")
    .orderBy("paidAt", "desc")
    .limit(50)
    .get();

  const payments = [];
  ordersSnap.forEach((doc) => {
    const data = doc.data();
    payments.push({
      orderId: doc.id,
      email: data.email,
      amount: data.amount,
      paidAt: data.paidAt?.toDate() || null,
      razorpayPaymentId: data.razorpayPaymentId,
    });
  });

  res.json({ payments });
});

/* ── Health ── */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/* ── Start ── */
app.listen(PORT, () => {
  console.log(`ILP Backend running on port ${PORT}`);
});

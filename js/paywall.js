import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";
import { API_URL, PRICE } from "./config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

/* ── Device ID — persistent per browser ── */
function getDeviceId() {
  let id = localStorage.getItem("ilp-device-id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("ilp-device-id", id);
  }
  return id;
}

/* ── Build the paywall overlay ── */
function createPaywall(isLoggedIn) {
  const wall = document.createElement("div");
  wall.id = "paywall";
  wall.innerHTML = `
    <div class="paywall-fade"></div>
    <div class="paywall-card">
      <div class="paywall-lock">🔒</div>
      <h3>Unlock Full Access</h3>
      <p class="paywall-desc">Get complete notes, all practice questions, walkthroughs, and exam tips for every TCS ILP subject.</p>
      <div class="paywall-price">₹${PRICE} <span>one-time</span></div>
      ${isLoggedIn
        ? `<button class="paywall-btn" id="payBtn">Pay ₹${PRICE} & Unlock</button>`
        : `<button class="paywall-btn" onclick="window.location.href=window.location.pathname.includes('/pages/')?'../login.html':'login.html'">Sign Up to Unlock</button>`
      }
      <p class="paywall-note">UPI, Cards, Net Banking accepted</p>
    </div>
  `;
  return wall;
}

/* ── Lock content after N sections ── */
function lockContent() {
  const mainContent = document.querySelector(".main section, .main");
  if (!mainContent) return;

  // Find all h3 sections — show first 2, lock the rest
  const headings = mainContent.querySelectorAll("h3[id]");
  if (headings.length <= 2) return; // too short to lock

  // Find the 3rd h3 — everything from there is locked
  const cutoffElement = headings[2];
  let lockFromHere = false;
  const allChildren = Array.from(mainContent.children);

  for (const child of allChildren) {
    if (child === cutoffElement || (lockFromHere && child.tagName !== "SCRIPT")) {
      lockFromHere = true;
      child.classList.add("locked-content");
    }
  }
}

/* ── Unlock content (paid user) ── */
function unlockContent() {
  document.querySelectorAll(".locked-content").forEach(el => {
    el.classList.remove("locked-content");
  });
  const wall = document.getElementById("paywall");
  if (wall) wall.remove();
}

/* ── Razorpay checkout ── */
async function startPayment(user) {
  const token = await user.getIdToken();

  // Create order
  const res = await fetch(`${API_URL}/api/payment/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
  });

  const data = await res.json();

  if (data.alreadyPaid) {
    unlockContent();
    return;
  }

  if (!data.orderId) {
    alert(data.error || "Payment service unavailable. Try again later.");
    return;
  }

  // Open Razorpay checkout
  const options = {
    key: data.keyId,
    amount: data.amount,
    currency: data.currency,
    name: "ILP Study Guide",
    description: "Full Access — All Subjects",
    order_id: data.orderId,
    handler: async function (response) {
      // Verify payment
      const verifyRes = await fetch(`${API_URL}/api/payment/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await user.getIdToken()}`,
        },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });

      const result = await verifyRes.json();
      if (result.success) {
        unlockContent();
      } else {
        alert("Payment verification failed. Contact support.");
      }
    },
    prefill: {
      email: user.email,
      name: user.displayName || "",
    },
    theme: {
      color: "#18181b",
    },
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

/* ── Main: check auth state and lock/unlock ── */
onAuthStateChanged(auth, async (user) => {
  if (user) {
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/api/user/status`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "X-Device-Id": getDeviceId(),
        },
      });

      const data = await res.json();

      if (data.paid) {
        unlockContent();
        return;
      }
    } catch (err) {
      // Backend unreachable — show locked state
      console.warn("Backend unreachable, showing locked content");
    }

    // User logged in but not paid
    lockContent();
    const wall = createPaywall(true);
    document.querySelector(".main")?.appendChild(wall);

    // Wire up pay button
    document.getElementById("payBtn")?.addEventListener("click", () => startPayment(user));

    // Register device
    try {
      const token = await user.getIdToken();
      await fetch(`${API_URL}/api/auth/register-device`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });
    } catch (_) {}

  } else {
    // Not logged in — show teaser + signup CTA
    lockContent();
    const wall = createPaywall(false);
    document.querySelector(".main")?.appendChild(wall);
  }
});

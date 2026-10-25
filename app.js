/* ============================================================
   Acme Cloud — client-side auth (no server, no build step)
   Talks to Supabase directly from the browser using the
   publishable key, which is safe to expose.
   ============================================================ */

const SUPABASE_URL = "https://oqjvxbudhljpygwlmzbs.supabase.co";
const SUPABASE_KEY = "sb_publishable_vm1Kli_ygsQnf7y4l0gxmg_P2BdH_Z_";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const $ = (id) => document.getElementById(id);

const authView = $("auth-view");
const dashView = $("dash-view");
const alertBox = $("alert");
const form = $("auth-form");
const nameField = $("name-field");
const submitBtn = $("submit-btn");
const magicBtn = $("magic-btn");

let mode = "signin"; // "signin" | "signup"

/* ---------- small helpers ---------- */

function showAlert(message, kind) {
  alertBox.textContent = message;
  alertBox.className = "msg " + kind;
  alertBox.hidden = false;
}

function clearAlert() {
  alertBox.hidden = true;
  alertBox.textContent = "";
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  magicBtn.disabled = loading;
  submitBtn.textContent = loading
    ? "Please wait…"
    : mode === "signup"
    ? "Create account"
    : "Sign in";
}

function setMode(next) {
  mode = next;
  clearAlert();
  $("tab-signin").classList.toggle("active", next === "signin");
  $("tab-signup").classList.toggle("active", next === "signup");
  nameField.hidden = next !== "signup";
  $("card-title").textContent = next === "signup" ? "Create your account" : "Sign in";
  $("card-sub").textContent =
    next === "signup"
      ? "Start free — no credit card required."
      : "Use your email to continue to your dashboard.";
  $("password").setAttribute(
    "autocomplete",
    next === "signup" ? "new-password" : "current-password"
  );
  submitBtn.textContent = next === "signup" ? "Create account" : "Sign in";
}

function fmt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN");
  } catch {
    return iso;
  }
}

/* ---------- views ---------- */

function showAuth() {
  dashView.hidden = true;
  authView.hidden = false;
}

async function showDashboard(user) {
  authView.hidden = true;
  dashView.hidden = false;

  const name =
    (user.user_metadata && user.user_metadata.full_name) ||
    (user.email || "").split("@")[0] ||
    "there";

  $("avatar").textContent = (name[0] || "?").toUpperCase();
  $("who-name").textContent = name;
  $("who-mail").textContent = user.email || "";
  $("welcome").textContent = "Welcome, " + name + " 👋";

  $("t-userid").textContent = user.id;
  $("t-email").textContent = user.email || "—";
  $("t-created").textContent = fmt(user.created_at);
  $("t-last").textContent = fmt(user.last_sign_in_at);

  // Fetch the profile row — protected by row-level security.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    $("profile-line").textContent = "Could not load profile: " + error.message;
  } else if (profile) {
    $("profile-line").innerHTML =
      "Full name: <strong>" + (profile.full_name || "— not set —") + "</strong><br>" +
      "Row created: " + fmt(profile.created_at);
  } else {
    $("profile-line").textContent =
      "No profile row yet — it is created automatically by a database trigger on signup.";
  }
}

/* ---------- session bootstrap ---------- */

async function refresh() {
  const { data } = await supabase.auth.getSession();
  if (data.session && data.session.user) {
    await showDashboard(data.session.user);
  } else {
    showAuth();
  }
}

supabase.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") showAuth();
});

/* ---------- events ---------- */

$("tab-signin").addEventListener("click", () => setMode("signin"));
$("tab-signup").addEventListener("click", () => setMode("signup"));

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearAlert();
  setLoading(true);

  const email = $("email").value.trim();
  const password = $("password").value;
  const fullName = $("full-name").value.trim();
  const redirectTo = window.location.origin + window.location.pathname;

  try {
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw error;

      if (data.session) {
        await refresh();
      } else {
        showAlert(
          "Account created. Check " + email + " for a confirmation link to finish signing in.",
          "ok"
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await refresh();
    }
  } catch (err) {
    showAlert(err.message || "Something went wrong. Please try again.", "err");
  } finally {
    setLoading(false);
  }
});

magicBtn.addEventListener("click", async () => {
  clearAlert();
  const email = $("email").value.trim();
  if (!email) {
    showAlert("Enter your email address first.", "err");
    return;
  }
  setLoading(true);
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) throw error;
    showAlert("Magic link sent to " + email + ". Check your inbox.", "ok");
  } catch (err) {
    showAlert(err.message || "Could not send the magic link.", "err");
  } finally {
    setLoading(false);
  }
});

$("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  showAuth();
  clearAlert();
});

/* ---------- boot ---------- */

// Surface errors Supabase appends to the URL (e.g. expired magic link).
(function handleUrlError() {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const params = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : search.slice(1)
  );
  const desc = params.get("error_description") || params.get("error");
  if (desc) {
    showAlert(decodeURIComponent(desc.replace(/\+/g, " ")), "err");
    history.replaceState(null, "", window.location.pathname);
  }
})();

setMode("signin");
refresh();

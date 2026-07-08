"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from "firebase/auth";

let firebaseAuth: any = null;
let googleProvider: any = null;

/**
 * Returns the current signed-in user's Firebase ID token, or null in demo mode
 * / when signed out. Used by authedFetch to authenticate API requests.
 */
export async function getCurrentIdToken(): Promise<string | null> {
  try {
    if (firebaseAuth && firebaseAuth.currentUser) {
      return await firebaseAuth.currentUser.getIdToken();
    }
  } catch (e) {
    console.error("Failed to get Firebase ID token", e);
  }
  return null;
}

function initFirebase(config: any) {
  if (!firebaseAuth && config && config.apiKey && config.apiKey !== "your_api_key" && !config.apiKey.startsWith("placeholder")) {
    try {
      const app = getApps().length === 0 ? initializeApp(config) : getApp();
      firebaseAuth = getAuth(app);
      googleProvider = new GoogleAuthProvider();
      console.log("🔥 Firebase dynamically initialized successfully!");
    } catch (error) {
      console.error("❌ Failed to initialize Firebase dynamically:", error);
    }
  }
}

interface AuthContextType {
  user: any; // Use standard Firebase User type or mock representation
  loading: boolean;
  isDemoMode: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isDemoMode: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// Utility helper to check if Firebase is configured properly
function getIsFirebaseConfigured(config: any) {
  const apiKey = config?.apiKey;
  return (
    !!apiKey && 
    apiKey !== "your_api_key" && 
    !apiKey.startsWith("placeholder")
  );
}

export function AuthProvider({ children, firebaseConfig }: { children: React.ReactNode, firebaseConfig: any }) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(true);

  useEffect(() => {
    const isConfigured = getIsFirebaseConfigured(firebaseConfig);

    if (!isConfigured) {
      setIsDemoMode(true);
      // Retrieve mock user from localStorage if it exists
      const savedUser = localStorage.getItem("umbrix_demo_user");
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error("Failed to parse local demo user", e);
        }
      }
      setLoading(false);
    } else {
      setIsDemoMode(false);
      initFirebase(firebaseConfig);
      
      if (firebaseAuth) {
        // Complete any pending redirect-based sign-in (the popup-blocked
        // fallback) and surface errors; onAuthStateChanged sets the user.
        getRedirectResult(firebaseAuth).catch((e) => {
          console.error("Redirect sign-in result error:", e);
        });

        const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
        return () => unsubscribe();
      } else {
        setLoading(false);
      }
    }
  }, [firebaseConfig]);

  const signInWithGoogle = async () => {
    const isConfigured = getIsFirebaseConfigured(firebaseConfig);

    if (!isConfigured) {
      console.log("👉 Executing Demo Mode guest login");
      setLoading(true);
      setTimeout(() => {
        const mockUser = {
          uid: "demo-user-123",
          displayName: "Hiroshi Tanaka",
          email: "hiroshi.tanaka@umbrix.io",
          photoURL: "https://api.dicebear.com/7.x/adventurer/svg?seed=Hiroshi",
        };
        localStorage.setItem("umbrix_demo_user", JSON.stringify(mockUser));
        setUser(mockUser);
        setLoading(false);
      }, 600);
      return;
    }

    // Ensure Firebase is initialized
    initFirebase(firebaseConfig);

    if (!firebaseAuth || !googleProvider) {
      console.error("❌ Firebase Auth not initialized");
      alert("Firebase Auth could not be initialized. Please check your credentials.");
      return;
    }

    console.log("👉 Executing live Firebase Google Sign-In");
    try {
      await signInWithPopup(firebaseAuth, googleProvider);
    } catch (error: any) {
      const code = error?.code || "";

      // The user intentionally dismissed the popup — not an error worth surfacing.
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
        return;
      }

      // Strict popup blockers (or environments that disallow popups) throw these.
      // Fall back to a full-page redirect, which is never popup-blocked.
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
        try {
          await signInWithRedirect(firebaseAuth, googleProvider);
          return;
        } catch (redirectError: any) {
          console.error("Redirect sign-in failed:", redirectError);
          alert(`Sign-In Error: ${redirectError?.message || redirectError}`);
          return;
        }
      }

      console.error("Error signing in with Google:", error);
      alert(`Firebase Sign-In Error: ${error.message || error}`);
    }
  };

  const logout = async () => {
    const isConfigured = getIsFirebaseConfigured(firebaseConfig);

    if (!isConfigured) {
      localStorage.removeItem("umbrix_demo_user");
      setUser(null);
      return;
    }

    if (firebaseAuth) {
      try {
        await signOut(firebaseAuth);
      } catch (error) {
        console.error("Error signing out:", error);
      }
    } else {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isDemoMode, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

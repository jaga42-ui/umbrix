import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.warn("⚠️ MONGODB_URI is not defined in environment variables. Database features will fallback to client-side localStorage.");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  lastFailureTime?: number;
}

// Global cached connection object to persist across hot reloads in development
let cached: MongooseCache = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  if (!MONGODB_URI) {
    return null;
  }

  // Circuit breaker: if connection failed in the last 15 seconds, fail fast to avoid blocking the thread pool
  if (cached.lastFailureTime && Date.now() - cached.lastFailureTime < 15000) {
    return null;
  }

  // Check if we have a cached connection and it is currently connected
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  // Hard timeout of 3 seconds to bypass OS DNS resolution hangs in offline networks
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), 3000);
  });

  const connectionPromise = (async () => {
    // If there is no promise or the connection is disconnected, start a new connection
    if (!cached.promise || mongoose.connection.readyState === 0) {
      const opts = {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging indefinitely
        connectTimeoutMS: 5000,         // Timeout connection establishment after 5s
        socketTimeoutMS: 5000,          // Timeout socket inactivity after 5s
      };

      cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
        console.log("✅ Successfully connected to MongoDB");
        // Clear failure time on success
        cached.lastFailureTime = undefined;
        return mongooseInstance;
      });
    }

    try {
      cached.conn = await cached.promise;
      return cached.conn;
    } catch (e) {
      cached.promise = null;
      cached.conn = null;
      cached.lastFailureTime = Date.now(); // Record failure timestamp
      console.error("❌ Failed to connect to MongoDB:", e);
      return null;
    }
  })();

  const result = await Promise.race([connectionPromise, timeoutPromise]);

  if (result === null) {
    // Connection timed out at the DNS/network level before Mongoose could throw
    cached.lastFailureTime = Date.now();
    console.warn("⚠️ Database connection timed out (3s limit). Falling back to demo mode.");
  }

  return result;
}

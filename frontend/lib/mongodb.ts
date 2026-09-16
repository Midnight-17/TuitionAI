import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI ?? ""

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined")
}

type MongooseCache = {
  connection: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var tuitionAiMongooseCache: MongooseCache | undefined
}

const cache = globalThis.tuitionAiMongooseCache ?? {
  connection: null,
  promise: null,
}

globalThis.tuitionAiMongooseCache = cache

export async function connectDB() {
  if (cache.connection && mongoose.connection.readyState === 1) {
    return cache.connection
  }

  if (!cache.promise || mongoose.connection.readyState === 0) {
    cache.promise = mongoose
      .connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      })
      .catch((error) => {
        cache.promise = null
        throw error
      })
  }

  cache.connection = await cache.promise
  return cache.connection
}

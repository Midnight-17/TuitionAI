import mongoose from "mongoose";


const MONGODB_URI = process.env.MONGODB_URI;

//iff not mongoob throw error
if(!MONGODB_URI){
    throw new Error ("MONGODB_URI is not defined")
}

//connect if ready state is more than 1 , 
/* 0 = disconnected
1 = connected
2 = connecting
3 = disconnecting */

export async function connectDB() {
    if (mongoose.connection.readyState >= 1) {
        return;
    }
    await mongoose.connect(MONGODB_URI!);
    
}

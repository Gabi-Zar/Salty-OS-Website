import mongoose from "mongoose";
import { Author } from "./models/author.js";
import { Theme } from "./models/theme.js";

export async function connectDB() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error("MONGO_URI is not set");

    try {
        await mongoose.connect(uri);
        await Promise.all([Author.init(), Theme.init()]);
    } catch (err) {
        throw new Error(`unable to connect to MongoDB: ${err.message}`, { cause: err });
    }
    console.log("Connected to MongoDB");
}

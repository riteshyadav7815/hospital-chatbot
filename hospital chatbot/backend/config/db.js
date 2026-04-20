const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/hospital_chatbot';
        await mongoose.connect(uri);
        console.log(`[DB] Successfully connected to MongoDB`);
    } catch (error) {
        console.error(`[DB] Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;

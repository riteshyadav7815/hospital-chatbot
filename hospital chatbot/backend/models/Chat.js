const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    patientId: {
        type: String,
        required: true,
        ref: 'Patient' // Reference to the generated patientId string
    },
    sessionId: {
        type: String,
        required: true
    },
    userMessage: {
        type: String
    },
    botMessage: {
        type: String
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Index to easily fetch history by patientId and order by time
chatSchema.index({ patientId: 1, timestamp: 1 });

module.exports = mongoose.model('Chat', chatSchema);

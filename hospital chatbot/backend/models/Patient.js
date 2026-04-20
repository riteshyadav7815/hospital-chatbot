const mongoose = require('mongoose');

const patientSchema = new mongoose.Schema({
    patientId: {
        type: String,
        required: true,
        unique: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    age: {
        type: Number,
        required: true
    },
    gender: {
        type: String,
        required: true,
        enum: ['Male', 'Female', 'Other']
    },
    phone: {
        type: String,
        required: true
    },
    email: {
        type: String,
        trim: true
    },
    address: {
        type: String
    },
    visitCount: {
        type: Number,
        default: 1
    },
    previousConditions: [{
        type: String
    }],
    currentSymptoms: {
        type: String
    },
    severity: {
        type: String
    },
    duration: {
        type: String
    },
    riskLevel: {
        type: String
    },
    aiSuggestion: {
        type: String
    },
    lastVisitDate: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt
});

// Auto-generate Patient ID before saving if it's a new document
patientSchema.pre('validate', async function(next) {
    if (this.isNew && !this.patientId) {
        try {
            // Find the patient with the highest patientId for the current year
            const currentYear = new Date().getFullYear();
            const prefix = `PAT-${currentYear}-`;
            
            const lastPatient = await this.constructor.findOne({
                patientId: new RegExp(`^${prefix}`)
            }).sort({ patientId: -1 });

            let sequenceNumber = 1;
            if (lastPatient && lastPatient.patientId) {
                const parts = lastPatient.patientId.split('-');
                if (parts.length === 3) {
                    sequenceNumber = parseInt(parts[2], 10) + 1;
                }
            }

            // Format to 4 digits, e.g., 0001
            const formattedSequence = sequenceNumber.toString().padStart(4, '0');
            this.patientId = `${prefix}${formattedSequence}`;
            next();
        } catch (error) {
            next(error);
        }
    } else {
        next();
    }
});

module.exports = mongoose.model('Patient', patientSchema);

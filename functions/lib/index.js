"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.notificationFunctions = exports.governanceFunctions = exports.gamificationFunctions = exports.automationFunctions = exports.financialFunctions = exports.membershipFunctions = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin SDK
admin.initializeApp();
// Export all cloud functions
var membership_1 = require("./membership");
Object.defineProperty(exports, "membershipFunctions", { enumerable: true, get: function () { return membership_1.membershipFunctions; } });
var financial_1 = require("./financial");
Object.defineProperty(exports, "financialFunctions", { enumerable: true, get: function () { return financial_1.financialFunctions; } });
var automation_1 = require("./automation");
Object.defineProperty(exports, "automationFunctions", { enumerable: true, get: function () { return automation_1.automationFunctions; } });
var gamification_1 = require("./gamification");
Object.defineProperty(exports, "gamificationFunctions", { enumerable: true, get: function () { return gamification_1.gamificationFunctions; } });
var governance_1 = require("./governance");
Object.defineProperty(exports, "governanceFunctions", { enumerable: true, get: function () { return governance_1.governanceFunctions; } });
var notifications_1 = require("./notifications");
Object.defineProperty(exports, "notificationFunctions", { enumerable: true, get: function () { return notifications_1.notificationFunctions; } });
// Health check function
exports.healthCheck = functions.https.onRequest((request, response) => {
    response.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
//# sourceMappingURL=index.js.map
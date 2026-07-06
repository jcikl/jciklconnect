"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthCheck = exports.notificationFunctions = exports.gamificationFunctions = exports.automationFunctions = exports.financialFunctions = exports.membershipFunctions = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
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
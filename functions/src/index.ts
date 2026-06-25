import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export all cloud functions
export { membershipFunctions } from './membership';
export { financialFunctions } from './financial';
export { automationFunctions } from './automation';
export { gamificationFunctions } from './gamification';
export { notificationFunctions } from './notifications';

// Health check function
export const healthCheck = functions.https.onRequest((request, response) => {
  response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});
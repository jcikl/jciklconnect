import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// Function to validate transaction splits
export const validateTransactionSplits = functions.firestore
  .document('transactions/{transactionId}')
  .onWrite(async (change, context) => {
    const transactionId = context.params.transactionId;
    
    // Skip if document was deleted
    if (!change.after.exists) {
      return null;
    }

    const transaction = change.after.data();
    
    // Only validate if transaction has splitIds
    if (!transaction.splitIds || transaction.splitIds.length === 0) {
      return null;
    }

    // Fetch splits from TRANSACTION_SPLITS collection
    const splitsSnapshot = await db.collection('transactionSplits')
      .where('parentTransactionId', '==', transactionId)
      .get();
    
    const splits = splitsSnapshot.docs.map(doc => doc.data());
    
    // Calculate sum of splits
    const splitSum = splits.reduce((sum: number, split: any) => sum + split.amount, 0);
    
    // Check if splits sum equals transaction amount (with small tolerance for floating point)
    const tolerance = 0.01;
    if (Math.abs(splitSum - transaction.amount) > tolerance) {
      console.error(`Transaction ${transactionId} split sum (${splitSum}) does not equal transaction amount (${transaction.amount})`);
      
      // Update transaction with validation error
      await db.collection('transactions').doc(transactionId).update({
        validationError: `Split amounts (${splitSum}) do not sum to transaction amount (${transaction.amount})`,
        validatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Clear any previous validation errors
      await db.collection('transactions').doc(transactionId).update({
        validationError: admin.firestore.FieldValue.delete(),
        validatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return null;
  });

// Function to generate financial reports
export const generateFinancialReport = functions.https.onCall(async (data, context) => {
  // Verify authentication and permissions
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userDoc = await db.collection('members').doc(context.auth.uid).get();
  if (!userDoc.exists || !['BOARD', 'ADMIN'].includes(userDoc.data()?.role)) {
    throw new functions.https.HttpsError('permission-denied', 'User must be board member or admin');
  }

  const { reportType, startDate, endDate, accountId } = data;

  if (!reportType || !startDate || !endDate) {
    throw new functions.https.HttpsError('invalid-argument', 'Report type, start date, and end date are required');
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Build query
  let query = db.collection('transactions')
    .where('date', '>=', start)
    .where('date', '<=', end);

  if (accountId) {
    query = query.where('accountId', '==', accountId);
  }

  const transactionsSnapshot = await query.get();
  const transactions = transactionsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // Generate report data based on type
  let reportData: any = {};

  switch (reportType) {
    case 'income':
      reportData = {
        transactions: transactions.filter((t: any) => t.type === 'income'),
        totalIncome: transactions
          .filter((t: any) => t.type === 'income')
          .reduce((sum: number, t: any) => sum + t.amount, 0)
      };
      break;

    case 'expense':
      reportData = {
        transactions: transactions.filter((t: any) => t.type === 'expense'),
        totalExpense: transactions
          .filter((t: any) => t.type === 'expense')
          .reduce((sum: number, t: any) => sum + t.amount, 0)
      };
      break;

    case 'balance_sheet':
      const income = transactions
        .filter((t: any) => t.type === 'income')
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      const expense = transactions
        .filter((t: any) => t.type === 'expense')
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      
      reportData = {
        totalIncome: income,
        totalExpense: expense,
        netBalance: income - expense,
        transactionCount: transactions.length
      };
      break;

    default:
      throw new functions.https.HttpsError('invalid-argument', 'Invalid report type');
  }

  // Save report to database
  const reportDoc = await db.collection('financialReports').add({
    type: reportType,
    startDate: start,
    endDate: end,
    accountId: accountId || null,
    data: reportData,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    generatedBy: context.auth.uid
  });

  return {
    reportId: reportDoc.id,
    data: reportData
  };
});

// Function to handle bank reconciliation
export const performBankReconciliation = functions.https.onCall(async (data, context) => {
  // Verify authentication and permissions
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userDoc = await db.collection('members').doc(context.auth.uid).get();
  if (!userDoc.exists || !['BOARD', 'ADMIN'].includes(userDoc.data()?.role)) {
    throw new functions.https.HttpsError('permission-denied', 'User must be board member or admin');
  }

  const { accountId, statementBalance, reconciliationDate } = data;

  if (!accountId || statementBalance === undefined || !reconciliationDate) {
    throw new functions.https.HttpsError('invalid-argument', 'Account ID, statement balance, and reconciliation date are required');
  }

  const reconDate = new Date(reconciliationDate);

  // Get all transactions up to reconciliation date
  const transactionsSnapshot = await db.collection('transactions')
    .where('accountId', '==', accountId)
    .where('date', '<=', reconDate)
    .get();

  // Calculate system balance by transaction type
  const transactionTypeSummary = {
    project: 0,
    operations: 0,
    dues: 0,
    merchandise: 0
  };

  let systemBalance = 0;

  transactionsSnapshot.docs.forEach(doc => {
    const transaction = doc.data();
    const amount = transaction.type === 'income' ? transaction.amount : -transaction.amount;
    systemBalance += amount;

    // Add to type summary
    if (transaction.transactionType && transactionTypeSummary.hasOwnProperty(transaction.transactionType)) {
      transactionTypeSummary[transaction.transactionType as keyof typeof transactionTypeSummary] += amount;
    }
  });

  // Find discrepancies
  const discrepancies = [];
  const balanceDifference = Math.abs(systemBalance - statementBalance);
  
  if (balanceDifference > 0.01) { // Allow for small rounding differences
    discrepancies.push({
      type: 'balance_mismatch',
      description: `System balance (${systemBalance}) does not match statement balance (${statementBalance})`,
      expectedAmount: statementBalance,
      actualAmount: systemBalance
    });
  }

  // Create reconciliation record
  const reconciliationDoc = await db.collection('reconciliations').add({
    accountId: accountId,
    reconciliationDate: reconDate,
    statementBalance: statementBalance,
    systemBalance: systemBalance,
    discrepancies: discrepancies,
    transactionTypeSummary: transactionTypeSummary,
    status: discrepancies.length === 0 ? 'completed' : 'in_progress',
    reconciledBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return {
    reconciliationId: reconciliationDoc.id,
    systemBalance: systemBalance,
    statementBalance: statementBalance,
    discrepancies: discrepancies,
    transactionTypeSummary: transactionTypeSummary
  };
});

export const financialFunctions = {
  validateTransactionSplits,
  generateFinancialReport,
  performBankReconciliation
};
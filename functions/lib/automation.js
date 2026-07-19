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
exports.automationFunctions = exports.evaluateAutomationRules = exports.executeWorkflow = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// Function to execute workflow
exports.executeWorkflow = functions.https.onCall(async (data, context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    // Only BOARD, ADMIN, and SUPER_ADMIN may trigger workflows manually
    const callerDoc = await db.collection('members').doc(context.auth.uid).get();
    const callerRole = (_a = callerDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (!['ADMIN', 'SUPER_ADMIN', 'BOARD'].includes(callerRole)) {
        throw new functions.https.HttpsError('permission-denied', 'Insufficient role to execute workflows');
    }
    const { workflowId, inputData } = data;
    if (!workflowId) {
        throw new functions.https.HttpsError('invalid-argument', 'Workflow ID is required');
    }
    // Get workflow definition
    const workflowDoc = await db.collection('workflows').doc(workflowId).get();
    if (!workflowDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Workflow not found');
    }
    const workflow = workflowDoc.data();
    if ((workflow === null || workflow === void 0 ? void 0 : workflow.status) !== 'active') {
        throw new functions.https.HttpsError('failed-precondition', 'Workflow is not active');
    }
    // Create execution record
    const executionDoc = await db.collection('workflow_executions').add({
        workflowId: workflowId,
        status: 'running',
        inputData: inputData || {},
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        startedBy: context.auth.uid,
        nodes: workflow.nodes.map((node) => (Object.assign(Object.assign({}, node), { status: 'pending', output: null, error: null })))
    });
    try {
        // Execute workflow nodes in order
        const results = await executeWorkflowNodes(workflow.nodes, inputData || {});
        // Update execution record with success
        await executionDoc.update({
            status: 'completed',
            results: results,
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            executionId: executionDoc.id,
            status: 'completed',
            results: results
        };
    }
    catch (error) {
        // Update execution record with error
        await executionDoc.update({
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            completedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        throw new functions.https.HttpsError('internal', 'Workflow execution failed');
    }
});
// Helper function to execute workflow nodes
async function executeWorkflowNodes(nodes, inputData) {
    const results = [];
    let currentData = inputData;
    for (const node of nodes) {
        try {
            const result = await executeNode(node, currentData);
            results.push({
                nodeId: node.id,
                type: node.type,
                status: 'completed',
                output: result
            });
            // Pass output to next node
            currentData = Object.assign(Object.assign({}, currentData), result);
        }
        catch (error) {
            results.push({
                nodeId: node.id,
                type: node.type,
                status: 'failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    return results;
}
// Helper function to execute individual node
async function executeNode(node, data) {
    switch (node.type) {
        case 'trigger':
            return { triggered: true, timestamp: new Date().toISOString() };
        case 'condition':
            const conditionResult = evaluateCondition(node.config, data);
            return { conditionMet: conditionResult };
        case 'action':
            return await executeAction(node.config, data);
        case 'delay':
            // F10 FIX: blocking setTimeout ties up the Cloud Function and risks timeout.
            // TODO: implement delay via Cloud Tasks for reliable deferred execution.
            console.warn('Delay node skipped in Cloud Function context — use Cloud Tasks for deferred actions.');
            return { delayed: 0, skipped: true };
        default:
            throw new Error(`Unknown node type: ${node.type}`);
    }
}
// Helper function to evaluate conditions
function evaluateCondition(config, data) {
    const { field, operator, value } = config;
    const fieldValue = data[field];
    switch (operator) {
        case 'equals':
            return fieldValue === value;
        case 'not_equals':
            return fieldValue !== value;
        case 'greater_than':
            return fieldValue > value;
        case 'less_than':
            return fieldValue < value;
        case 'contains':
            return String(fieldValue).includes(String(value));
        default:
            return false;
    }
}
// Helper function to execute actions
async function executeAction(config, data) {
    var _a, _b, _c, _d;
    switch (config.type) {
        case 'send_email':
            // SEC-A-009: Do not log recipient email or subject — use a correlation reference only.
            console.log(`send_email action triggered (type: ${(_a = config.notificationType) !== null && _a !== void 0 ? _a : 'email'})`);
            return { emailSent: true, to: config.to };
        case 'update_field': {
            // Update a document field — restricted to an explicit allowlist to prevent
            // workflows from writing to sensitive or unintended collections.
            const ALLOWED_COLLECTIONS = [
                'members', 'events', 'projects', 'tasks', 'notifications',
                'workflows', 'activityPlans', 'eventRegistrations'
            ];
            if (config.collection && config.documentId && config.field) {
                if (!ALLOWED_COLLECTIONS.includes(config.collection)) {
                    console.error(`executeAction: collection '${config.collection}' not in allowlist — update_field blocked`);
                    return { fieldUpdated: false, blocked: true };
                }
                await db.collection(config.collection).doc(config.documentId).update({
                    [config.field]: config.value,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return { fieldUpdated: true };
            }
            throw new Error('Invalid update_field configuration');
        }
        case 'create_record':
            // Create a new document
            if (config.collection && config.data) {
                const docRef = await db.collection(config.collection).add(Object.assign(Object.assign({}, config.data), { createdAt: admin.firestore.FieldValue.serverTimestamp() }));
                return { recordCreated: true, documentId: docRef.id };
            }
            throw new Error('Invalid create_record configuration');
        case 'award_points':
            // Award points to a member
            if (config.memberId && config.points) {
                await db.collection('points').add({
                    memberId: config.memberId,
                    points: config.points,
                    reason: config.reason || 'Workflow action',
                    createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
                return { pointsAwarded: true, points: config.points };
            }
            throw new Error('Invalid award_points configuration');
        // P1-C: Implement create_task action so automation rules that specify
        // this action type actually produce a task document instead of throwing.
        case 'create_task': {
            const taskRef = await db.collection('tasks').add({
                title: ((_b = config.params) === null || _b === void 0 ? void 0 : _b.title) || config.title || 'Auto-created task',
                assignedTo: ((_c = config.params) === null || _c === void 0 ? void 0 : _c.assignedTo) || config.assignedTo || '',
                projectId: ((_d = config.params) === null || _d === void 0 ? void 0 : _d.projectId) || config.projectId || '',
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                _automationGenerated: true,
                automationRuleId: data.ruleId || null,
            });
            return { taskCreated: true, documentId: taskRef.id };
        }
        default:
            throw new Error(`Unknown action type: ${config.type}`);
    }
}
// Collections that automation actions write to — triggering this function from
// these would cause an infinite loop (automation fires → writes points →
// automation fires again → …).  Skip evaluation for all of them.
const AUTOMATION_SIDE_EFFECT_COLLECTIONS = [
    'points',
    'pointTransactions',
    'notifications',
    'rule_executions',
    'ruleExecutions',
    'workflowExecutions',
    'workflow_executions',
    'automationLogs',
    'tasks',
    // P0 self-trigger guard: the rule-fired handler updates lastTriggeredAt/triggerCount
    // on automationRules documents, which would re-fire this same function → infinite loop.
    'automationRules',
];
// TODO: Scheduled automation rules (triggerType: 'schedule') require a Cloud
// Scheduler / Cloud Tasks trigger — not yet implemented.  Rules with a
// schedule field are currently ignored by this Firestore-triggered function.
// Function to evaluate automation rules
// F10 FIX: extend timeout to 300 s and raise memory to prevent OOM on large rule sets.
exports.evaluateAutomationRules = functions
    .runWith({ timeoutSeconds: 300, memory: '512MB' })
    .firestore
    .document('{collection}/{documentId}')
    .onWrite(async (change, context) => {
    // P0-A: Bail out early when the write came from an automation side-effect
    // collection to prevent an infinite trigger loop.
    const triggeredCollection = context.params.collection;
    if (AUTOMATION_SIDE_EFFECT_COLLECTIONS.includes(triggeredCollection)) {
        console.log('Skipping automation evaluation for side-effect collection:', context.resource.name);
        return null;
    }
    // Also skip documents that were written by automation itself.
    const afterData = change.after.exists ? change.after.data() : null;
    if ((afterData === null || afterData === void 0 ? void 0 : afterData._automationGenerated) === true) {
        console.log('Skipping automation evaluation for _automationGenerated document:', context.resource.name);
        return null;
    }
    // CF-07: Outer try/catch prevents the wildcard trigger from retrying indefinitely
    // when there is an infrastructure error (quota, network) fetching rules or writing
    // execution logs. The inner per-rule try/catch already isolates bad rule configs.
    try {
        // Get all active automation rules
        const rulesSnapshot = await db.collection('automationRules')
            .where('enabled', '==', true)
            .get();
        if (rulesSnapshot.empty) {
            return null;
        }
        const document = change.after.exists ? change.after.data() : null;
        const collection = context.params.collection;
        const documentId = context.params.documentId;
        // Evaluate each rule
        for (const ruleDoc of rulesSnapshot.docs) {
            const rule = ruleDoc.data();
            // Check if rule applies to this collection
            if (rule.trigger && rule.trigger !== collection) {
                continue;
            }
            try {
                // Evaluate rule conditions
                const conditionsMet = evaluateRuleConditions(rule.conditions, rule.logicOperator, document);
                if (conditionsMet) {
                    // Execute rule actions
                    await executeRuleActions(rule.actions, {
                        collection,
                        documentId,
                        document,
                        ruleId: ruleDoc.id
                    });
                    // P1-B: Increment triggerCount on the rule so we have an accurate
                    // count of how many times each rule has fired.
                    await ruleDoc.ref.update({
                        lastTriggeredAt: admin.firestore.FieldValue.serverTimestamp(),
                        triggerCount: admin.firestore.FieldValue.increment(1),
                    });
                    // Log rule execution
                    await db.collection('rule_executions').add({
                        ruleId: ruleDoc.id,
                        triggeredBy: {
                            collection,
                            documentId
                        },
                        executedAt: admin.firestore.FieldValue.serverTimestamp(),
                        conditionsEvaluated: rule.conditions,
                        actionsExecuted: rule.actions
                    });
                }
            }
            catch (error) {
                console.error(`Error executing rule ${ruleDoc.id}:`, error);
            }
        }
    }
    catch (error) {
        console.error('[evaluateAutomationRules] Outer infrastructure error — aborting without retry:', error);
        return null;
    }
    return null;
});
// Helper function to evaluate rule conditions
function evaluateRuleConditions(conditions, logicOperator, document) {
    if (!conditions || conditions.length === 0) {
        return true;
    }
    const results = conditions.map(condition => {
        const fieldValue = document === null || document === void 0 ? void 0 : document[condition.field];
        return evaluateCondition(condition, { [condition.field]: fieldValue });
    });
    if (logicOperator === 'AND') {
        return results.every(result => result);
    }
    else if (logicOperator === 'OR') {
        return results.some(result => result);
    }
    return false;
}
// Helper function to execute rule actions
async function executeRuleActions(actions, context) {
    for (const action of actions) {
        try {
            await executeAction(action, context);
        }
        catch (error) {
            console.error('Error executing rule action:', error);
        }
    }
}
exports.automationFunctions = {
    executeWorkflow: exports.executeWorkflow,
    evaluateAutomationRules: exports.evaluateAutomationRules
};
//# sourceMappingURL=automation.js.map
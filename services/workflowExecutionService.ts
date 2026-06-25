// Workflow Execution Service - Execute workflows and track execution state
import { 
  Workflow, 
  WorkflowExecution, 
  WorkflowNodeExecution, 
  WorkflowNode,
  WorkflowConnection 
} from '../types';
import { isDevMode } from '../utils/devMode';

export class WorkflowExecutionService {
  /**
   * Execute workflow in test mode
   */
  static async executeWorkflowTest(
    workflow: Workflow,
    testData: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    if (isDevMode()) {
      // Return mock execution for development
      return this.createMockExecution(workflow);
    }

    const execution: WorkflowExecution = {
      id: `exec_${Date.now()}`,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: 'running',
      startedAt: new Date().toISOString(),
      triggeredBy: 'manual',
      triggerData: testData,
      nodeExecutions: [],
      executedSteps: []
    };

    try {
      // Find trigger nodes
      const triggerNodes = workflow.nodes.filter(n => n.type === 'trigger');
      
      if (triggerNodes.length === 0) {
        throw new Error('No trigger nodes found in workflow');
      }

      // Execute from each trigger
      for (const trigger of triggerNodes) {
        await this.executeNodeChain(trigger, workflow, execution, testData);
      }

      execution.status = 'success';
      execution.completedAt = new Date().toISOString();
      execution.duration = new Date(execution.completedAt).getTime() - 
                          new Date(execution.startedAt).getTime();

    } catch (error) {
      execution.status = 'failed';
      execution.error = {
        message: error instanceof Error ? error.message : 'Unknown error',
        stepId: 'workflow_execution',
        stepType: 'workflow'
      };
      execution.completedAt = new Date().toISOString();
      execution.duration = new Date(execution.completedAt).getTime() - 
                          new Date(execution.startedAt).getTime();
    }

    return execution;
  }

  /**
   * Execute a chain of nodes starting from a given node
   */
  private static async executeNodeChain(
    startNode: WorkflowNode,
    workflow: Workflow,
    execution: WorkflowExecution,
    context: Record<string, any>
  ): Promise<void> {
    const visited = new Set<string>();
    const queue: WorkflowNode[] = [startNode];

    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      
      if (visited.has(currentNode.id)) continue;
      visited.add(currentNode.id);

      // Execute node
      const nodeExecution = await this.executeNode(currentNode, context);
      execution.nodeExecutions.push(nodeExecution);

      // If node failed, stop execution
      if (nodeExecution.status === 'failed') {
        throw new Error(`Node ${currentNode.data.label} failed: ${nodeExecution.error}`);
      }

      // Update context with node output
      if (nodeExecution.output) {
        context[currentNode.id] = nodeExecution.output;
      }

      // Find next nodes
      const nextConnections = workflow.connections.filter(
        c => c.sourceNodeId === currentNode.id
      );

      for (const connection of nextConnections) {
        const nextNode = workflow.nodes.find(n => n.id === connection.targetNodeId);
        if (nextNode && !visited.has(nextNode.id)) {
          queue.push(nextNode);
        }
      }
    }
  }

  /**
   * Execute a single node
   */
  private static async executeNode(
    node: WorkflowNode,
    context: Record<string, any>
  ): Promise<WorkflowNodeExecution> {
    const nodeExecution: WorkflowNodeExecution = {
      id: `node_exec_${Date.now()}`,
      nodeId: node.id,
      nodeType: node.type,
      status: 'running',
      startedAt: new Date().toISOString(),
      input: { ...context },
    };

    try {
      // Simulate node execution based on type
      const output = await this.simulateNodeExecution(node, context);
      
      nodeExecution.status = 'success';
      nodeExecution.output = output;
      nodeExecution.completedAt = new Date().toISOString();
      nodeExecution.duration = new Date(nodeExecution.completedAt).getTime() - 
                              new Date(nodeExecution.startedAt!).getTime();

    } catch (error) {
      nodeExecution.status = 'failed';
      nodeExecution.error = error instanceof Error ? error.message : 'Unknown error';
      nodeExecution.completedAt = new Date().toISOString();
      nodeExecution.duration = new Date(nodeExecution.completedAt!).getTime() - 
                              new Date(nodeExecution.startedAt!).getTime();
    }

    return nodeExecution;
  }

  /**
   * Simulate node execution (for testing)
   */
  private static async simulateNodeExecution(
    node: WorkflowNode,
    context: Record<string, any>
  ): Promise<Record<string, any>> {
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 400));

    const config = node.config || {};

    switch (node.type) {
      case 'trigger':
        return { triggered: true, timestamp: new Date().toISOString() };

      case 'email':
        return {
          sent: true,
          to: config.to,
          subject: config.subject,
          messageId: `msg_${Date.now()}`,
        };

      case 'notification':
        return {
          sent: true,
          title: config.title,
          recipients: config.recipients,
          notificationId: `notif_${Date.now()}`,
        };

      case 'condition':
        // Evaluate condition
        const field = config.field;
        const operator = config.operator;
        const value = config.value;
        
        let result = false;
        const fieldValue = this.getFieldValue(field, context);
        
        switch (operator) {
          case 'equals':
            result = fieldValue == value;
            break;
          case 'greater_than':
            result = fieldValue > value;
            break;
          case 'less_than':
            result = fieldValue < value;
            break;
          case 'contains':
            result = String(fieldValue).includes(String(value));
            break;
          case 'exists':
            result = fieldValue !== undefined && fieldValue !== null;
            break;
          default:
            result = false;
        }
        
        return { conditionMet: result, field, operator, value, actualValue: fieldValue };

      case 'delay':
        return { delayed: true, duration: config.duration, unit: config.unit };

      case 'data_update':
        return {
          updated: true,
          table: config.table,
          recordId: config.recordId,
          fields: config.fields,
        };

      case 'task_create':
        return {
          created: true,
          taskId: `task_${Date.now()}`,
          title: config.title,
          assignee: config.assignee,
        };

      case 'webhook':
        return {
          called: true,
          url: config.url,
          method: config.method,
          statusCode: 200,
          response: { success: true },
        };

      case 'approval':
        return {
          approvalRequested: true,
          approvers: config.approvers,
          approvalId: `approval_${Date.now()}`,
        };

      case 'loop':
        return {
          looped: true,
          collection: config.collection,
          iterations: 0, // Would be calculated based on collection
        };

      case 'action':
        return {
          executed: true,
          actionType: config.actionType,
          result: 'Action completed successfully',
        };

      case 'end':
        return {
          workflowEnded: true,
          message: config.message,
          returnData: config.returnData,
        };

      default:
        return { executed: true };
    }
  }

  /**
   * Get field value from context using dot notation
   */
  private static getFieldValue(field: string, context: Record<string, any>): any {
    const parts = field.split('.');
    let value: any = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Create mock execution for development
   */
  private static createMockExecution(workflow: Workflow): WorkflowExecution {
    const nodeExecutions: WorkflowNodeExecution[] = workflow.nodes.map((node, index) => ({
      id: `node_exec_mock_${index}`,
      nodeId: node.id,
      nodeType: node.type,
      status: Math.random() > 0.1 ? 'success' : 'failed',
      startedAt: new Date(Date.now() - 5000).toISOString(),
      completedAt: new Date(Date.now() - 1000).toISOString(),
      input: { testData: true },
      output: { result: 'success', nodeType: node.type },
      duration: 4000,
      error: Math.random() > 0.9 ? 'Mock error for testing' : undefined,
    }));

    return {
      id: `exec_mock_${Date.now()}`,
      workflowId: workflow.id,
      workflowName: workflow.name,
      status: nodeExecutions.some(n => n.status === 'failed') ? 'failed' : 'success',
      startedAt: new Date(Date.now() - 10000).toISOString(),
      completedAt: new Date().toISOString(),
      triggeredBy: 'manual',
      triggerData: { test: true },
      nodeExecutions,
      executedSteps: nodeExecutions.map((n, index) => ({
        stepId: n.nodeId,
        stepType: n.nodeType,
        stepOrder: index,
        status: n.status === 'success' ? 'completed' : n.status,
        startedAt: n.startedAt,
        completedAt: n.completedAt,
        duration: n.duration
      })),
      duration: 10000,
    };
  }

  /**
   * Get execution history for a workflow
   */
  static async getExecutionHistory(workflowId: string, limit: number = 10): Promise<WorkflowExecution[]> {
    if (isDevMode()) {
      // Return mock history
      return Array.from({ length: Math.min(limit, 5) }, (_, i) => ({
        id: `exec_${i}`,
        workflowId,
        workflowName: `Workflow ${workflowId}`,
        status: i % 3 === 0 ? 'failed' : 'success',
        startedAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
        completedAt: new Date(Date.now() - (i + 1) * 3600000 + 5000).toISOString(),
        triggeredBy: 'manual',
        triggerData: {},
        nodeExecutions: [],
        executedSteps: [],
        duration: 5000,
      }));
    }

    // TODO: Implement actual database query
    return [];
  }

  /**
   * Cancel running execution
   */
  static async cancelExecution(executionId: string): Promise<void> {
    if (isDevMode()) {
      console.log(`Cancelled execution: ${executionId}`);
      return;
    }

    // TODO: Implement actual cancellation logic
  }
}
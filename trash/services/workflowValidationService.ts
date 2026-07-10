// Workflow Validation Service - Validate workflow configurations and detect issues
import { Workflow, WorkflowNode, WorkflowConnection, WorkflowNodeType } from '../types';
import { isDevMode } from '../utils/devMode';

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  id: string;
  type: 'missing_config' | 'invalid_config' | 'circular_dependency' | 'orphaned_node' | 'missing_connection' | 'invalid_flow';
  nodeId?: string;
  connectionId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  id: string;
  type: 'performance' | 'best_practice' | 'accessibility';
  nodeId?: string;
  message: string;
}

export class WorkflowValidationService {
  /**
   * Validate entire workflow
   */
  static validateWorkflow(workflow: Workflow): ValidationResult {
    if (isDevMode()) {
      // Return mock validation for development
      return {
        isValid: true,
        errors: [],
        warnings: [
          {
            id: 'mock_warning_1',
            type: 'best_practice',
            nodeId: workflow.nodes[0]?.id,
            message: 'Consider adding error handling to this workflow',
          },
        ],
      };
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate workflow structure
    const structureErrors = this.validateWorkflowStructure(workflow);
    errors.push(...structureErrors);

    // Validate individual nodes
    workflow.nodes.forEach(node => {
      const nodeErrors = this.validateNode(node, workflow);
      errors.push(...nodeErrors);
    });

    // Validate connections
    workflow.connections.forEach(connection => {
      const connectionErrors = this.validateConnection(connection, workflow);
      errors.push(...connectionErrors);
    });

    // Check for circular dependencies
    const circularErrors = this.detectCircularDependencies(workflow);
    errors.push(...circularErrors);

    // Check for orphaned nodes
    const orphanedErrors = this.detectOrphanedNodes(workflow);
    errors.push(...orphanedErrors);

    // Generate performance warnings
    const performanceWarnings = this.generatePerformanceWarnings(workflow);
    warnings.push(...performanceWarnings);

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate workflow structure
   */
  private static validateWorkflowStructure(workflow: Workflow): ValidationError[] {
    const errors: ValidationError[] = [];

    // Must have at least one trigger node
    const triggerNodes = workflow.nodes.filter(n => n.type === 'trigger');
    if (triggerNodes.length === 0) {
      errors.push({
        id: 'no_trigger',
        type: 'missing_connection',
        message: 'Workflow must have at least one trigger node',
        severity: 'error',
      });
    }

    // Should have at least one end node
    const endNodes = workflow.nodes.filter(n => n.type === 'end');
    if (endNodes.length === 0) {
      errors.push({
        id: 'no_end',
        type: 'missing_connection',
        message: 'Workflow should have at least one end node',
        severity: 'warning',
      });
    }

    // Check for duplicate node IDs
    const nodeIds = workflow.nodes.map(n => n.id);
    const duplicateIds = nodeIds.filter((id, index) => nodeIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push({
        id: 'duplicate_node_ids',
        type: 'invalid_config',
        message: `Duplicate node IDs found: ${duplicateIds.join(', ')}`,
        severity: 'error',
      });
    }

    // Check for duplicate connection IDs
    const connectionIds = workflow.connections.map(c => c.id);
    const duplicateConnectionIds = connectionIds.filter((id, index) => connectionIds.indexOf(id) !== index);
    if (duplicateConnectionIds.length > 0) {
      errors.push({
        id: 'duplicate_connection_ids',
        type: 'invalid_config',
        message: `Duplicate connection IDs found: ${duplicateConnectionIds.join(', ')}`,
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Validate individual node
   */
  private static validateNode(node: WorkflowNode, workflow: Workflow): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check required configuration
    const requiredConfig = this.getRequiredNodeConfig(node.type);
    requiredConfig.forEach(configKey => {
      if (!node.config || !node.config[configKey]) {
        errors.push({
          id: `missing_config_${node.id}_${configKey}`,
          type: 'missing_config',
          nodeId: node.id,
          message: `Node "${node.data.label}" is missing required configuration: ${configKey}`,
          severity: 'error',
        });
      }
    });

    // Validate node-specific configuration
    const nodeConfigErrors = this.validateNodeConfig(node);
    errors.push(...nodeConfigErrors);

    // Check node position
    if (node.position.x < 0 || node.position.y < 0) {
      errors.push({
        id: `invalid_position_${node.id}`,
        type: 'invalid_config',
        nodeId: node.id,
        message: `Node "${node.data.label}" has invalid position`,
        severity: 'warning',
      });
    }

    return errors;
  }

  /**
   * Validate connection
   */
  private static validateConnection(connection: WorkflowConnection, workflow: Workflow): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check if source and target nodes exist
    const sourceNode = workflow.nodes.find(n => n.id === connection.sourceNodeId);
    const targetNode = workflow.nodes.find(n => n.id === connection.targetNodeId);

    if (!sourceNode) {
      errors.push({
        id: `missing_source_${connection.id}`,
        type: 'missing_connection',
        connectionId: connection.id,
        message: `Connection references non-existent source node: ${connection.sourceNodeId}`,
        severity: 'error',
      });
    }

    if (!targetNode) {
      errors.push({
        id: `missing_target_${connection.id}`,
        type: 'missing_connection',
        connectionId: connection.id,
        message: `Connection references non-existent target node: ${connection.targetNodeId}`,
        severity: 'error',
      });
    }

    // Check for self-connections
    if (connection.sourceNodeId === connection.targetNodeId) {
      errors.push({
        id: `self_connection_${connection.id}`,
        type: 'invalid_flow',
        connectionId: connection.id,
        message: 'Node cannot connect to itself',
        severity: 'error',
      });
    }

    // Validate flow direction
    if (sourceNode && targetNode) {
      const flowErrors = this.validateFlowDirection(sourceNode, targetNode, connection);
      errors.push(...flowErrors);
    }

    return errors;
  }

  /**
   * Detect circular dependencies
   */
  private static detectCircularDependencies(workflow: Workflow): ValidationError[] {
    const errors: ValidationError[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Build adjacency list
    const graph = new Map<string, string[]>();
    workflow.nodes.forEach(node => {
      graph.set(node.id, []);
    });

    workflow.connections.forEach(connection => {
      const sourceConnections = graph.get(connection.sourceNodeId) || [];
      sourceConnections.push(connection.targetNodeId);
      graph.set(connection.sourceNodeId, sourceConnections);
    });

    // DFS to detect cycles
    const hasCycle = (nodeId: string, path: string[]): boolean => {
      if (recursionStack.has(nodeId)) {
        // Found cycle
        const cycleStart = path.indexOf(nodeId);
        const cyclePath = path.slice(cycleStart).concat(nodeId);
        errors.push({
          id: `circular_dependency_${nodeId}`,
          type: 'circular_dependency',
          nodeId,
          message: `Circular dependency detected: ${cyclePath.map(id => {
            const node = workflow.nodes.find(n => n.id === id);
            return node?.data.label || id;
          }).join(' → ')}`,
          severity: 'error',
        });
        return true;
      }

      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = graph.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor, [...path, nodeId])) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    // Check each node
    workflow.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        hasCycle(node.id, []);
      }
    });

    return errors;
  }

  /**
   * Detect orphaned nodes
   */
  private static detectOrphanedNodes(workflow: Workflow): ValidationError[] {
    const errors: ValidationError[] = [];
    const connectedNodes = new Set<string>();

    // Mark all connected nodes
    workflow.connections.forEach(connection => {
      connectedNodes.add(connection.sourceNodeId);
      connectedNodes.add(connection.targetNodeId);
    });

    // Find orphaned nodes (not connected and not triggers)
    workflow.nodes.forEach(node => {
      if (!connectedNodes.has(node.id) && node.type !== 'trigger') {
        errors.push({
          id: `orphaned_node_${node.id}`,
          type: 'orphaned_node',
          nodeId: node.id,
          message: `Node "${node.data.label}" is not connected to the workflow`,
          severity: 'warning',
        });
      }
    });

    return errors;
  }

  /**
   * Generate performance warnings
   */
  private static generatePerformanceWarnings(workflow: Workflow): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Too many nodes
    if (workflow.nodes.length > 50) {
      warnings.push({
        id: 'too_many_nodes',
        type: 'performance',
        message: `Workflow has ${workflow.nodes.length} nodes. Consider breaking it into smaller workflows for better performance.`,
      });
    }

    // Too many connections
    if (workflow.connections.length > 100) {
      warnings.push({
        id: 'too_many_connections',
        type: 'performance',
        message: `Workflow has ${workflow.connections.length} connections. This may impact performance.`,
      });
    }

    // Deep nesting
    const maxDepth = this.calculateMaxDepth(workflow);
    if (maxDepth > 10) {
      warnings.push({
        id: 'deep_nesting',
        type: 'performance',
        message: `Workflow has a maximum depth of ${maxDepth} levels. Consider flattening the structure.`,
      });
    }

    // Multiple loops
    const loopNodes = workflow.nodes.filter(n => n.type === 'loop');
    if (loopNodes.length > 3) {
      warnings.push({
        id: 'multiple_loops',
        type: 'performance',
        message: `Workflow contains ${loopNodes.length} loop nodes. This may impact performance.`,
      });
    }

    return warnings;
  }

  /**
   * Get required configuration for node type
   */
  private static getRequiredNodeConfig(nodeType: WorkflowNodeType): string[] {
    const requiredConfigs: Record<WorkflowNodeType, string[]> = {
      trigger: ['triggerType'],
      email: ['to', 'subject', 'body'],
      notification: ['title', 'message', 'recipients'],
      condition: ['field', 'operator', 'value'],
      delay: ['duration', 'unit'],
      data_update: ['table', 'recordId', 'fields'],
      task_create: ['title', 'assignee'],
      webhook: ['url', 'method'],
      approval: ['approvers', 'title'],
      loop: ['collection', 'itemVariable'],
      action: ['actionType'],
      end: [],
    };

    return requiredConfigs[nodeType] || [];
  }

  /**
   * Validate node-specific configuration
   */
  private static validateNodeConfig(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.config || {};

    switch (node.type) {
      case 'email':
        if (config.to && !config.to.includes('@') && !config.to.includes('{{')) {
          errors.push({
            id: `invalid_email_${node.id}`,
            type: 'invalid_config',
            nodeId: node.id,
            message: 'Email "to" field must be a valid email address or template variable',
            severity: 'error',
          });
        }
        break;

      case 'webhook':
        if (config.url) {
          try {
            new URL(config.url);
          } catch {
            errors.push({
              id: `invalid_url_${node.id}`,
              type: 'invalid_config',
              nodeId: node.id,
              message: 'Webhook URL is not valid',
              severity: 'error',
            });
          }
        }
        break;

      case 'delay':
        if (config.duration && config.duration <= 0) {
          errors.push({
            id: `invalid_duration_${node.id}`,
            type: 'invalid_config',
            nodeId: node.id,
            message: 'Delay duration must be greater than 0',
            severity: 'error',
          });
        }
        break;

      case 'loop':
        if (config.maxIterations && config.maxIterations > 1000) {
          errors.push({
            id: `excessive_iterations_${node.id}`,
            type: 'invalid_config',
            nodeId: node.id,
            message: 'Loop max iterations cannot exceed 1000',
            severity: 'error',
          });
        }
        break;
    }

    return errors;
  }

  /**
   * Validate flow direction between nodes
   */
  private static validateFlowDirection(
    sourceNode: WorkflowNode,
    targetNode: WorkflowNode,
    connection: WorkflowConnection
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Trigger nodes should not have incoming connections
    if (targetNode.type === 'trigger') {
      errors.push({
        id: `invalid_trigger_input_${connection.id}`,
        type: 'invalid_flow',
        connectionId: connection.id,
        message: 'Trigger nodes cannot have incoming connections',
        severity: 'error',
      });
    }

    // End nodes should not have outgoing connections
    if (sourceNode.type === 'end') {
      errors.push({
        id: `invalid_end_output_${connection.id}`,
        type: 'invalid_flow',
        connectionId: connection.id,
        message: 'End nodes cannot have outgoing connections',
        severity: 'error',
      });
    }

    return errors;
  }

  /**
   * Calculate maximum depth of workflow
   */
  private static calculateMaxDepth(workflow: Workflow): number {
    const graph = new Map<string, string[]>();
    
    // Build adjacency list
    workflow.nodes.forEach(node => {
      graph.set(node.id, []);
    });

    workflow.connections.forEach(connection => {
      const sourceConnections = graph.get(connection.sourceNodeId) || [];
      sourceConnections.push(connection.targetNodeId);
      graph.set(connection.sourceNodeId, sourceConnections);
    });

    // Find trigger nodes (starting points)
    const triggerNodes = workflow.nodes.filter(n => n.type === 'trigger');
    
    let maxDepth = 0;

    const calculateDepth = (nodeId: string, visited: Set<string>): number => {
      if (visited.has(nodeId)) return 0; // Avoid infinite loops
      
      visited.add(nodeId);
      const neighbors = graph.get(nodeId) || [];
      
      if (neighbors.length === 0) return 1;
      
      let maxChildDepth = 0;
      for (const neighbor of neighbors) {
        const childDepth = calculateDepth(neighbor, new Set(visited));
        maxChildDepth = Math.max(maxChildDepth, childDepth);
      }
      
      return 1 + maxChildDepth;
    };

    // Calculate depth from each trigger
    triggerNodes.forEach(trigger => {
      const depth = calculateDepth(trigger.id, new Set());
      maxDepth = Math.max(maxDepth, depth);
    });

    return maxDepth;
  }

  /**
   * Validate workflow before execution
   */
  static validateForExecution(workflow: Workflow): ValidationResult {
    const result = this.validateWorkflow(workflow);
    
    // Additional execution-specific validations
    const executionErrors: ValidationError[] = [];

    // Must have at least one trigger
    const triggers = workflow.nodes.filter(n => n.type === 'trigger');
    if (triggers.length === 0) {
      executionErrors.push({
        id: 'no_executable_trigger',
        type: 'missing_connection',
        message: 'Workflow must have at least one trigger to be executable',
        severity: 'error',
      });
    }

    // All triggers must be properly configured
    triggers.forEach(trigger => {
      if (!trigger.config || !trigger.config.triggerType) {
        executionErrors.push({
          id: `unconfigured_trigger_${trigger.id}`,
          type: 'missing_config',
          nodeId: trigger.id,
          message: 'Trigger node must be configured before execution',
          severity: 'error',
        });
      }
    });

    return {
      ...result,
      errors: [...result.errors, ...executionErrors],
      isValid: result.isValid && executionErrors.filter(e => e.severity === 'error').length === 0,
    };
  }
}
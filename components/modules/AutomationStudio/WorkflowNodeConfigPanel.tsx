import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  AlertTriangle, 
  Info, 
  Settings, 
  Mail, 
  Bell, 
  Database, 
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { WorkflowNode, WorkflowNodeType } from '../../../types';
import * as Forms from '../../ui/Form';

interface WorkflowNodeConfigPanelProps {
  node: WorkflowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeId: string, config: Record<string, any>) => void;
  onValidate?: (nodeId: string, config: Record<string, any>) => string[];
}

interface NodeConfigSchema {
  [key: string]: {
    type: 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'email' | 'url' | 'json';
    label: string;
    description?: string;
    required?: boolean;
    options?: { value: string; label: string }[];
    placeholder?: string;
    validation?: (value: any) => string | null;
  };
}

const NODE_CONFIG_SCHEMAS: Record<WorkflowNodeType, NodeConfigSchema> = {
  trigger: {
    triggerType: {
      type: 'select',
      label: 'Trigger Type',
      description: 'How this workflow should be triggered',
      required: true,
      options: [
        { value: 'manual', label: 'Manual Trigger' },
        { value: 'schedule', label: 'Scheduled' },
        { value: 'event', label: 'Event-based' },
        { value: 'webhook', label: 'Webhook' },
      ],
    },
    scheduleExpression: {
      type: 'string',
      label: 'Schedule Expression',
      description: 'Cron expression for scheduled triggers',
      placeholder: '0 9 * * MON-FRI',
    },
    eventType: {
      type: 'select',
      label: 'Event Type',
      description: 'Type of event to listen for',
      options: [
        { value: 'member_joined', label: 'Member Joined' },
        { value: 'event_created', label: 'Event Created' },
        { value: 'project_completed', label: 'Project Completed' },
        { value: 'dues_paid', label: 'Dues Paid' },
      ],
    },
  },
  email: {
    to: {
      type: 'string',
      label: 'To Email',
      description: 'Recipient email address or template variable',
      required: true,
      placeholder: '{{member.email}} or user@example.com',
      validation: (value) => {
        if (!value) return 'Email recipient is required';
        if (!value.includes('@') && !value.includes('{{')) {
          return 'Must be a valid email or template variable';
        }
        return null;
      },
    },
    subject: {
      type: 'string',
      label: 'Subject',
      description: 'Email subject line',
      required: true,
      placeholder: 'Welcome to JCI KL!',
    },
    body: {
      type: 'textarea',
      label: 'Email Body',
      description: 'Email content (supports HTML and template variables)',
      required: true,
      placeholder: 'Hello {{member.name}}, welcome to our community!',
    },
    fromName: {
      type: 'string',
      label: 'From Name',
      description: 'Sender name',
      placeholder: 'JCI Kuala Lumpur',
    },
    priority: {
      type: 'select',
      label: 'Priority',
      description: 'Email priority level',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' },
      ],
    },
  },
  notification: {
    title: {
      type: 'string',
      label: 'Notification Title',
      description: 'Title of the notification',
      required: true,
      placeholder: 'New Event Available',
    },
    message: {
      type: 'textarea',
      label: 'Message',
      description: 'Notification message content',
      required: true,
      placeholder: 'A new event has been created that might interest you.',
    },
    recipients: {
      type: 'select',
      label: 'Recipients',
      description: 'Who should receive this notification',
      required: true,
      options: [
        { value: 'all_members', label: 'All Members' },
        { value: 'board_members', label: 'Board Members Only' },
        { value: 'specific_user', label: 'Specific User' },
        { value: 'role_based', label: 'Role-based' },
      ],
    },
    urgency: {
      type: 'select',
      label: 'Urgency',
      description: 'Notification urgency level',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' },
      ],
    },
  },
  condition: {
    field: {
      type: 'string',
      label: 'Field to Check',
      description: 'Field name or path to evaluate',
      required: true,
      placeholder: 'member.points or event.attendees',
    },
    operator: {
      type: 'select',
      label: 'Operator',
      description: 'Comparison operator',
      required: true,
      options: [
        { value: 'equals', label: 'Equals' },
        { value: 'not_equals', label: 'Not Equals' },
        { value: 'greater_than', label: 'Greater Than' },
        { value: 'less_than', label: 'Less Than' },
        { value: 'contains', label: 'Contains' },
        { value: 'exists', label: 'Exists' },
      ],
    },
    value: {
      type: 'string',
      label: 'Value',
      description: 'Value to compare against',
      required: true,
      placeholder: '100 or "active"',
    },
    trueLabel: {
      type: 'string',
      label: 'True Branch Label',
      description: 'Label for the true condition path',
      placeholder: 'Yes',
    },
    falseLabel: {
      type: 'string',
      label: 'False Branch Label',
      description: 'Label for the false condition path',
      placeholder: 'No',
    },
  },
  delay: {
    duration: {
      type: 'number',
      label: 'Duration',
      description: 'How long to wait',
      required: true,
      placeholder: '5',
      validation: (value) => {
        if (!value || value <= 0) return 'Duration must be greater than 0';
        return null;
      },
    },
    unit: {
      type: 'select',
      label: 'Time Unit',
      description: 'Unit of time for the delay',
      required: true,
      options: [
        { value: 'seconds', label: 'Seconds' },
        { value: 'minutes', label: 'Minutes' },
        { value: 'hours', label: 'Hours' },
        { value: 'days', label: 'Days' },
      ],
    },
  },
  data_update: {
    table: {
      type: 'select',
      label: 'Table/Collection',
      description: 'Database table to update',
      required: true,
      options: [
        { value: 'members', label: 'Members' },
        { value: 'events', label: 'Events' },
        { value: 'projects', label: 'Projects' },
        { value: 'transactions', label: 'Transactions' },
      ],
    },
    recordId: {
      type: 'string',
      label: 'Record ID',
      description: 'ID of the record to update',
      required: true,
      placeholder: '{{member.id}} or specific ID',
    },
    fields: {
      type: 'json',
      label: 'Fields to Update',
      description: 'JSON object with field names and values',
      required: true,
      placeholder: '{"status": "active", "lastLogin": "{{now}}"}',
    },
  },
  task_create: {
    title: {
      type: 'string',
      label: 'Task Title',
      description: 'Title of the task to create',
      required: true,
      placeholder: 'Follow up with new member',
    },
    description: {
      type: 'textarea',
      label: 'Task Description',
      description: 'Detailed description of the task',
      placeholder: 'Contact the new member to schedule orientation.',
    },
    assignee: {
      type: 'string',
      label: 'Assignee',
      description: 'Who should be assigned this task',
      placeholder: '{{board.president}} or specific user ID',
    },
    dueDate: {
      type: 'string',
      label: 'Due Date',
      description: 'When the task should be completed',
      placeholder: '{{now + 7 days}} or 2024-12-31',
    },
    priority: {
      type: 'select',
      label: 'Priority',
      description: 'Task priority level',
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'urgent', label: 'Urgent' },
      ],
    },
  },
  webhook: {
    url: {
      type: 'url',
      label: 'Webhook URL',
      description: 'URL to send the HTTP request to',
      required: true,
      placeholder: 'https://api.example.com/webhook',
      validation: (value) => {
        if (!value) return 'URL is required';
        try {
          new URL(value);
          return null;
        } catch {
          return 'Must be a valid URL';
        }
      },
    },
    method: {
      type: 'select',
      label: 'HTTP Method',
      description: 'HTTP method to use',
      required: true,
      options: [
        { value: 'GET', label: 'GET' },
        { value: 'POST', label: 'POST' },
        { value: 'PUT', label: 'PUT' },
        { value: 'PATCH', label: 'PATCH' },
        { value: 'DELETE', label: 'DELETE' },
      ],
    },
    headers: {
      type: 'json',
      label: 'Headers',
      description: 'HTTP headers to include',
      placeholder: '{"Authorization": "Bearer {{token}}", "Content-Type": "application/json"}',
    },
    body: {
      type: 'json',
      label: 'Request Body',
      description: 'JSON body to send with the request',
      placeholder: '{"event": "{{event.type}}", "data": "{{event.data}}"}',
    },
  },
  approval: {
    approvers: {
      type: 'string',
      label: 'Approvers',
      description: 'Who can approve this step',
      required: true,
      placeholder: 'board.president,board.secretary',
    },
    title: {
      type: 'string',
      label: 'Approval Title',
      description: 'Title for the approval request',
      required: true,
      placeholder: 'Approve new member application',
    },
    description: {
      type: 'textarea',
      label: 'Approval Description',
      description: 'Details about what needs approval',
      placeholder: 'Please review and approve the new member application.',
    },
    timeout: {
      type: 'number',
      label: 'Timeout (hours)',
      description: 'Hours to wait before auto-rejection',
      placeholder: '72',
    },
  },
  loop: {
    collection: {
      type: 'string',
      label: 'Collection',
      description: 'Data collection to iterate over',
      required: true,
      placeholder: '{{members}} or {{events}}',
    },
    itemVariable: {
      type: 'string',
      label: 'Item Variable',
      description: 'Variable name for each item',
      required: true,
      placeholder: 'member',
    },
    maxIterations: {
      type: 'number',
      label: 'Max Iterations',
      description: 'Maximum number of iterations (safety limit)',
      placeholder: '100',
      validation: (value) => {
        if (value && value > 1000) return 'Max iterations cannot exceed 1000';
        return null;
      },
    },
  },
  action: {
    actionType: {
      type: 'select',
      label: 'Action Type',
      description: 'Type of action to perform',
      required: true,
      options: [
        { value: 'log', label: 'Log Message' },
        { value: 'calculate', label: 'Calculate Value' },
        { value: 'transform', label: 'Transform Data' },
      ],
    },
    parameters: {
      type: 'json',
      label: 'Parameters',
      description: 'Action-specific parameters',
      placeholder: '{"message": "Action completed", "level": "info"}',
    },
  },
  end: {
    message: {
      type: 'string',
      label: 'Completion Message',
      description: 'Message to log when workflow ends',
      placeholder: 'Workflow completed successfully',
    },
    returnData: {
      type: 'json',
      label: 'Return Data',
      description: 'Data to return from the workflow',
      placeholder: '{"status": "completed", "result": "{{result}}"}',
    },
  },
};

export const WorkflowNodeConfigPanel: React.FC<WorkflowNodeConfigPanelProps> = ({
  node,
  isOpen,
  onClose,
  onSave,
  onValidate,
}) => {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (node) {
      setConfig(node.config || {});
      setErrors({});
      setValidationErrors([]);
    }
  }, [node]);

  if (!isOpen || !node) return null;

  const schema = NODE_CONFIG_SCHEMAS[node.type] || {};

  const handleFieldChange = (fieldName: string, value: any) => {
    const newConfig = { ...config, [fieldName]: value };
    setConfig(newConfig);

    // Clear field error
    if (errors[fieldName]) {
      setErrors(prev => ({ ...prev, [fieldName]: '' }));
    }

    // Run field validation
    const fieldSchema = schema[fieldName];
    if (fieldSchema?.validation) {
      const error = fieldSchema.validation(value);
      if (error) {
        setErrors(prev => ({ ...prev, [fieldName]: error }));
      }
    }
  };

  const validateConfig = () => {
    const newErrors: Record<string, string> = {};
    
    // Validate required fields
    Object.entries(schema).forEach(([fieldName, fieldSchema]) => {
      if (fieldSchema.required && !config[fieldName]) {
        newErrors[fieldName] = `${fieldSchema.label} is required`;
      }
      
      // Run custom validation
      if (fieldSchema.validation && config[fieldName]) {
        const error = fieldSchema.validation(config[fieldName]);
        if (error) {
          newErrors[fieldName] = error;
        }
      }
    });

    setErrors(newErrors);

    // Run external validation
    if (onValidate) {
      const externalErrors = onValidate(node.id, config);
      setValidationErrors(externalErrors);
    }

    return Object.keys(newErrors).length === 0 && validationErrors.length === 0;
  };

  const handleSave = () => {
    if (validateConfig()) {
      onSave(node.id, config);
      onClose();
    }
  };

  const renderField = (fieldName: string, fieldSchema: NodeConfigSchema[string]) => {
    const value = config[fieldName] || '';
    const error = errors[fieldName];

    switch (fieldSchema.type) {
      case 'select':
        return (
          <Forms.Select
            label={fieldSchema.label}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            error={error}
            required={fieldSchema.required}
            options={[
              { value: '', label: `Select ${fieldSchema.label}` },
              ...(fieldSchema.options || [])
            ]}
          >
            <option value="">Select {fieldSchema.label}</option>
            {fieldSchema.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Forms.Select>
        );

      case 'textarea':
        return (
          <Forms.Textarea
            label={fieldSchema.label}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={fieldSchema.placeholder}
            error={error}
            required={fieldSchema.required}
            rows={4}
          />
        );

      case 'number':
        return (
          <Forms.Input
            type="number"
            label={fieldSchema.label}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, parseFloat(e.target.value) || 0)}
            placeholder={fieldSchema.placeholder}
            error={error}
            required={fieldSchema.required}
          />
        );

      case 'boolean':
        return (
          <Forms.Checkbox
            label={fieldSchema.label}
            checked={!!value}
            onChange={(e) => handleFieldChange(fieldName, e.target.checked)}
            error={error}
          />
        );

      case 'json':
        return (
          <div>
            <Forms.Textarea
              label={fieldSchema.label}
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleFieldChange(fieldName, parsed);
                } catch {
                  handleFieldChange(fieldName, e.target.value);
                }
              }}
              placeholder={fieldSchema.placeholder}
              error={error}
              required={fieldSchema.required}
              rows={6}
            />
            {fieldSchema.description && (
              <p className="text-sm text-gray-500 mt-1">{fieldSchema.description}</p>
            )}
          </div>
        );

      default:
        return (
          <Forms.Input
            type={fieldSchema.type === 'email' ? 'email' : fieldSchema.type === 'url' ? 'url' : 'text'}
            label={fieldSchema.label}
            value={value}
            onChange={(e) => handleFieldChange(fieldName, e.target.value)}
            placeholder={fieldSchema.placeholder}
            error={error}
            required={fieldSchema.required}
          />
        );
    }
  };

  const getNodeIcon = (nodeType: WorkflowNodeType) => {
    switch (nodeType) {
      case 'email': return <Mail className="w-5 h-5" />;
      case 'notification': return <Bell className="w-5 h-5" />;
      case 'data_update': return <Database className="w-5 h-5" />;
      case 'delay': return <Clock className="w-5 h-5" />;
      case 'condition': return <AlertTriangle className="w-5 h-5" />;
      default: return <Settings className="w-5 h-5" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              {getNodeIcon(node.type)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Configure {node.data.label}</h2>
              <p className="text-sm text-gray-500">{node.data.description}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {validationErrors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <h3 className="font-medium text-red-800">Validation Errors</h3>
              </div>
              <ul className="list-disc list-inside text-sm text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-6">
            {Object.entries(schema).map(([fieldName, fieldSchema]) => (
              <div key={fieldName}>
                {renderField(fieldName, fieldSchema)}
                {fieldSchema.description && !errors[fieldName] && (
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <Info size={14} />
                    {fieldSchema.description}
                  </p>
                )}
              </div>
            ))}

            {Object.keys(schema).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Settings className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No configuration options available for this node type.</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <CheckCircle className="w-4 h-4" />
            Changes are saved automatically
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Save size={16} />
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
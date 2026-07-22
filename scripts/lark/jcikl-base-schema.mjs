const text = (name) => ({ name, type: 'text' });
const number = (name, precision = 0) => ({
  name,
  type: 'number',
  style: { type: 'plain', formatter: precision === 0 ? '0' : `0.${'0'.repeat(precision)}` },
});
const money = (name) => ({
  name,
  type: 'number',
  style: { type: 'currency', currency_code: 'MYR', formatter: '0.00' },
});
const dateTime = (name) => ({
  name,
  type: 'datetime',
  style: { format: 'yyyy-MM-dd HH:mm' },
});
const checkbox = (name) => ({ name, type: 'checkbox' });
const select = (name, options, multiple = false) => ({
  name,
  type: 'select',
  multiple,
  options: options.map((option) => ({ name: option })),
});

const sourceFields = () => [
  text('Firebase ID'),
  text('LO ID'),
  dateTime('Source Created At'),
  dateTime('Source Updated At'),
];

export const BASE_SCHEMA_VERSION = '1.0.0';

export const BASE_SCHEMA = {
  name: 'JCI KL Connect Database',
  timeZone: 'Asia/Kuala_Lumpur',
  tables: [
    {
      key: 'members',
      name: '01 Members',
      sourceCollections: ['members'],
      fields: [
        text('Member Name'), ...sourceFields(), text('Email'), text('Phone'),
        select('Role', ['Member', 'Admin', 'Super Admin']),
        select('Membership Type', ['Regular', 'Associate', 'Honorary', 'Prospective']),
        select('Membership Tier', ['Bronze', 'Silver', 'Gold', 'Platinum']),
        select('Dues Status', ['Paid', 'Pending', 'Overdue', 'Waived']),
        dateTime('Join Date'), number('Points'), text('Company'), text('Position'),
        text('Industry'), text('Address'), text('Current Board Position'), checkbox('Active'),
      ],
    },
    {
      key: 'board_members',
      name: '02 Board Members',
      sourceCollections: ['boardMembers'],
      fields: [
        text('Board Appointment'), ...sourceFields(), text('Member Firebase ID'),
        text('Member Name'), text('Position'), text('Term'), dateTime('Start Date'),
        dateTime('End Date'), checkbox('Active'), text('Permissions JSON'),
      ],
    },
    {
      key: 'projects',
      name: '11 Projects',
      sourceCollections: ['projects', 'flagship_projects'],
      fields: [
        text('Project Name'), ...sourceFields(), text('Description'),
        select('Status', ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled']),
        text('Lead Firebase ID'), text('Lead Name'), text('Level'), text('Pillar'),
        text('Category'), dateTime('Start Date'), dateTime('End Date'), money('Budget'),
        money('Spent'), number('Completion %'), number('Team Size'), text('Location'),
        text('Objectives'), text('Impact'), text('Target Audience'),
      ],
    },
    {
      key: 'project_committee',
      name: '12 Project Committee',
      sourceCollections: ['projects[].committee'],
      fields: [
        text('Committee Assignment'), ...sourceFields(), text('Project Firebase ID'),
        text('Member Firebase ID'), text('Member Name'), text('Role'),
        select('Status', ['Invited', 'Active', 'Completed', 'Withdrawn']), text('Responsibilities'),
      ],
    },
    {
      key: 'tasks',
      name: '13 Tasks',
      sourceCollections: ['tasks'],
      fields: [
        text('Task Title'), ...sourceFields(), text('Project Firebase ID'), text('Project Name'),
        text('Assignee Firebase ID'), text('Assignee Name'), text('Committee Role'),
        select('Status', ['Todo', 'In Progress', 'Blocked', 'Done', 'Cancelled']),
        select('Priority', ['Low', 'Medium', 'High', 'Urgent']), dateTime('Start Date'),
        dateTime('Due Date'), number('Progress %'), text('Dependencies'), text('Notes'),
      ],
    },
    {
      key: 'events',
      name: '14 Events',
      sourceCollections: ['events'],
      fields: [
        text('Event Title'), ...sourceFields(), text('Description'),
        select('Status', ['Draft', 'Published', 'Ongoing', 'Completed', 'Cancelled']),
        text('Type'), dateTime('Start Date'), dateTime('End Date'), text('Location'),
        money('Price'), number('Capacity'), number('Attendees'), text('Organizer Firebase ID'),
        text('Organizer Name'),
      ],
    },
    {
      key: 'event_registrations',
      name: '15 Event Registrations',
      sourceCollections: ['eventRegistrations'],
      fields: [
        text('Registration'), ...sourceFields(), text('Event Firebase ID'), text('Event Title'),
        text('Member Firebase ID'), text('Member Name'),
        select('Status', ['Registered', 'Paid', 'Checked In', 'Cancelled']),
        dateTime('Registered At'), dateTime('Paid At'), dateTime('Checked In At'),
        text('Payment Method'), text('Finance Transaction Firebase ID'), text('Dietary Requirements'),
        text('Emergency Contact'), text('Payment Reference'),
      ],
    },
    {
      key: 'event_budgets',
      name: '16 Event Budgets',
      sourceCollections: ['eventBudgets'],
      fields: [
        text('Budget Name'), ...sourceFields(), text('Event Firebase ID'), text('Event Title'),
        money('Planned Income'), money('Planned Expense'), money('Actual Income'),
        money('Actual Expense'), money('Variance'),
        select('Status', ['Draft', 'Approved', 'Active', 'Closed']),
        number('Alert Threshold %'), text('Category Details JSON'),
      ],
    },
    {
      key: 'bank_accounts',
      name: '21 Bank Accounts',
      sourceCollections: ['bankAccounts'],
      fields: [
        text('Account Name'), ...sourceFields(), text('Bank Name'), text('Account Number'),
        text('Account Type'), text('Currency'), money('Opening Balance'), money('Current Balance'),
        dateTime('Last Reconciled At'), money('Reconciled Balance'), checkbox('Active'), text('Notes'),
      ],
    },
    {
      key: 'transactions',
      name: '22 Transactions',
      sourceCollections: ['transactions', 'projectTrx'],
      fields: [
        text('Transaction'), ...sourceFields(), dateTime('Transaction Date'), text('Description'),
        text('Purpose'), money('Amount'), select('Type', ['Income', 'Expense']), text('Category'),
        select('Status', ['Draft', 'Pending', 'Approved', 'Paid', 'Completed', 'Cancelled', 'Reversed']),
        text('Bank Account Firebase ID'), text('Project Firebase ID'), text('Member Firebase ID'),
        text('Payment Request Firebase ID'), text('Reference'), text('Payment Method'),
        number('Financial Year'), select('Match Status', ['Unmatched', 'Matched', 'Reconciled']),
        text('Source'),
      ],
    },
    {
      key: 'transaction_splits',
      name: '23 Transaction Splits',
      sourceCollections: ['transactionSplits'],
      fields: [
        text('Split'), ...sourceFields(), text('Parent Transaction Firebase ID'),
        text('Project Firebase ID'), text('Member Firebase ID'), text('Payment Request Firebase ID'),
        money('Amount'), select('Type', ['Income', 'Expense']), text('Category'),
        text('Description'), number('Financial Year'), checkbox('Reconciled'),
      ],
    },
    {
      key: 'payment_requests',
      name: '24 Payment Requests',
      sourceCollections: ['paymentRequests'],
      fields: [
        text('Request'), ...sourceFields(), text('Applicant Firebase ID'), text('Applicant Name'),
        dateTime('Request Date'), text('Category'), text('Activity Firebase ID'), text('Activity Name'),
        money('Amount'), text('Remark'), text('Bank Name'), text('Bank Account Number'),
        text('Bank Account Holder'), text('Reference'),
        select('Status', ['Draft', 'Submitted', 'Under Review', 'Approved', 'Rejected', 'Paid', 'Cancelled']),
        text('Reviewer Firebase ID'), text('Review Notes'), dateTime('Reviewed At'), dateTime('Paid At'),
      ],
    },
    {
      key: 'inventory',
      name: '25 Inventory',
      sourceCollections: ['inventory'],
      fields: [
        text('Item Name'), ...sourceFields(), text('Category'), number('Quantity'), number('Minimum Quantity'),
        text('Location'), select('Status', ['Available', 'Low Stock', 'Out of Stock', 'Retired']),
        text('Custodian Firebase ID'), text('Custodian Name'),
        select('Condition', ['New', 'Good', 'Fair', 'Poor', 'Damaged']),
        dateTime('Purchase Date'), money('Purchase Value'), money('Current Value'), text('Notes'),
      ],
    },
    {
      key: 'stock_movements',
      name: '26 Stock Movements',
      sourceCollections: ['stock_movements'],
      fields: [
        text('Movement'), ...sourceFields(), text('Item Firebase ID'), text('Item Name'),
        dateTime('Movement Date'), select('Type', ['In', 'Out', 'Adjustment', 'Transfer']),
        number('Quantity'), number('Quantity Before'), number('Quantity After'), text('Variant'),
        text('Reason'), text('Reference'), text('Performed By Firebase ID'), text('Performed By Name'),
      ],
    },
    {
      key: 'sponsorships',
      name: '31 Sponsorships',
      sourceCollections: ['sponsorships'],
      fields: [
        text('Sponsorship'), ...sourceFields(), text('Member Firebase ID'), text('Member Name'),
        text('Sponsor Name'), money('Amount'), dateTime('Date'), text('Description'), text('Reference'),
      ],
    },
    {
      key: 'points_ledger',
      name: '32 Points Ledger',
      sourceCollections: ['points'],
      fields: [
        text('Point Entry'), ...sourceFields(), text('Member Firebase ID'), text('Member Name'),
        number('Points'), text('Category'), text('Description'), text('Source Type'),
        text('Source Firebase ID'), dateTime('Awarded At'), dateTime('Expires At'),
        text('Awarded By Firebase ID'), text('Awarded By Name'),
      ],
    },
    {
      key: 'mentorship_matches',
      name: '33 Mentorship Matches',
      sourceCollections: ['mentorMatches'],
      fields: [
        text('Mentorship Match'), ...sourceFields(), text('Mentor Firebase ID'), text('Mentor Name'),
        text('Mentee Firebase ID'), text('Mentee Name'), number('Compatibility Score', 2),
        select('Status', ['Proposed', 'Active', 'Paused', 'Completed', 'Cancelled']),
        dateTime('Start Date'), dateTime('End Date'), text('Compatibility Factors JSON'), text('Notes'),
      ],
    },
    {
      key: 'member_benefits',
      name: '34 Member Benefits',
      sourceCollections: ['memberBenefits'],
      fields: [
        text('Benefit Name'), ...sourceFields(), text('Description'), text('Type'), text('Category'),
        text('Eligibility'), dateTime('Valid From'), dateTime('Valid Until'), number('Usage Limit'),
        number('Usage Count'), select('Status', ['Draft', 'Active', 'Paused', 'Expired']),
        text('Provider'), text('Terms'),
      ],
    },
    {
      key: 'benefit_usage',
      name: '35 Benefit Usage',
      sourceCollections: ['benefitUsage'],
      fields: [
        text('Benefit Usage'), ...sourceFields(), text('Member Firebase ID'), text('Member Name'),
        text('Benefit Firebase ID'), text('Benefit Name'), dateTime('Used At'), text('Notes'),
      ],
    },
  ],
  relations: [
    ['board_members', 'Member', 'members'],
    ['projects', 'Project Lead', 'members'],
    ['project_committee', 'Project', 'projects'],
    ['project_committee', 'Member', 'members'],
    ['tasks', 'Project', 'projects'],
    ['tasks', 'Assignee', 'members'],
    ['events', 'Organizer', 'members'],
    ['event_registrations', 'Project / Event', 'projects'],
    ['event_registrations', 'Member', 'members'],
    ['event_registrations', 'Finance Transaction', 'transactions'],
    ['event_budgets', 'Project / Event', 'projects'],
    ['transactions', 'Bank Account', 'bank_accounts'],
    ['transactions', 'Project', 'projects'],
    ['transactions', 'Member', 'members'],
    ['transactions', 'Payment Request', 'payment_requests'],
    ['transaction_splits', 'Parent Transaction', 'transactions'],
    ['transaction_splits', 'Project', 'projects'],
    ['transaction_splits', 'Member', 'members'],
    ['transaction_splits', 'Payment Request', 'payment_requests'],
    ['payment_requests', 'Applicant', 'members'],
    ['payment_requests', 'Activity / Project', 'projects'],
    ['payment_requests', 'Bank Account', 'bank_accounts'],
    ['inventory', 'Custodian', 'members'],
    ['stock_movements', 'Inventory Item', 'inventory'],
    ['stock_movements', 'Performed By', 'members'],
    ['sponsorships', 'Member', 'members'],
    ['points_ledger', 'Member', 'members'],
    ['points_ledger', 'Awarded By', 'members'],
    ['mentorship_matches', 'Mentor', 'members'],
    ['mentorship_matches', 'Mentee', 'members'],
    ['benefit_usage', 'Member', 'members'],
    ['benefit_usage', 'Benefit', 'member_benefits'],
  ],
  excludedCollections: [
    'workflowExecutions', 'workflowLogs', 'webhookLogs', 'errorLogs', 'auditLogs',
    'memberEmails', 'birthdayNotificationsSent', 'counters', 'systemConfig', 'caches',
  ],
};

export function validateSchema(schema = BASE_SCHEMA) {
  const errors = [];
  const tableKeys = new Set();
  const tableNames = new Set();

  for (const table of schema.tables) {
    if (tableKeys.has(table.key)) errors.push(`Duplicate table key: ${table.key}`);
    if (tableNames.has(table.name)) errors.push(`Duplicate table name: ${table.name}`);
    tableKeys.add(table.key);
    tableNames.add(table.name);

    const fieldNames = new Set();
    for (const field of table.fields) {
      if (fieldNames.has(field.name)) errors.push(`Duplicate field in ${table.name}: ${field.name}`);
      fieldNames.add(field.name);
    }
  }

  for (const [source, fieldName, target] of schema.relations) {
    if (!tableKeys.has(source)) errors.push(`Relation source does not exist: ${source}.${fieldName}`);
    if (!tableKeys.has(target)) errors.push(`Relation target does not exist: ${source}.${fieldName} -> ${target}`);
  }

  if (errors.length) throw new Error(`Invalid Lark Base schema:\n- ${errors.join('\n- ')}`);
  return true;
}

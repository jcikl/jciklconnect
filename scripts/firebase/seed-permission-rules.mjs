#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const REPORT_PATH = resolve(process.cwd(), 'firebase-permission-seed-report.json');
const CREDENTIAL_PATH = resolve(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  'serviceAccountKey.json',
);

const permissions = [
  { key: 'members.view', name: 'View member directory', category: 'Members', description: 'Can view member directory and profiles' },
  { key: 'members.manage', name: 'Manage members', category: 'Members', description: 'Can create or edit member records' },
  { key: 'members.export', name: 'Export members', category: 'Members', description: 'Can export member data' },
  { key: 'board.view', name: 'View board records', category: 'Board', description: 'Can view board member records' },
  { key: 'board.manage', name: 'Manage board records', category: 'Board', description: 'Can edit board composition and terms' },
  { key: 'events.view', name: 'View events', category: 'Events', description: 'Can view event list' },
  { key: 'events.manage', name: 'Manage events', category: 'Events', description: 'Can create or edit events and projects' },
  { key: 'finance.view', name: 'View finance', category: 'Finance', description: 'Can view finance records' },
  { key: 'finance.manage', name: 'Manage finance', category: 'Finance', description: 'Can create or edit finance records' },
  { key: 'payments.approve', name: 'Approve payments', category: 'Finance', description: 'Can approve payment requests' },
  { key: 'inventory.view', name: 'View inventory', category: 'Inventory', description: 'Can view inventory' },
  { key: 'inventory.manage', name: 'Manage inventory', category: 'Inventory', description: 'Can create or edit inventory' },
  { key: 'reports.view', name: 'View reports', category: 'Reports', description: 'Can view reports' },
  { key: 'reports.export', name: 'Export reports', category: 'Reports', description: 'Can export reports' },
  { key: 'system.config', name: 'Manage system config', category: 'System', description: 'Can manage system settings' },
  { key: 'data.import_export', name: 'Import/export data', category: 'Data', description: 'Can use data import and export tools' },
];

const roleRuleSets = [
  { role: 'Admin', priority: 100, keys: ['members.view','members.manage','members.export','board.view','board.manage','events.view','events.manage','finance.view','finance.manage','payments.approve','inventory.view','inventory.manage','reports.view','reports.export','system.config','data.import_export'] },
  { role: 'Super Admin', priority: 100, keys: ['members.view','members.manage','members.export','board.view','board.manage','events.view','events.manage','finance.view','finance.manage','payments.approve','inventory.view','inventory.manage','reports.view','reports.export','system.config','data.import_export'] },
  { role: 'Developer', priority: 100, keys: ['reports.view','system.config','data.import_export'] },
  { role: 'Board', priority: 100, keys: ['members.view','board.view','board.manage','events.view','events.manage','finance.view','payments.approve','reports.view'] },
  { role: 'Member', priority: 100, keys: ['members.view','events.view','board.view'] },
  { role: 'Guest', priority: 100, keys: ['events.view'] },
];

const membershipRuleSets = [
  { membershipType: 'Regular', priority: 50, keys: ['members.view','events.view','board.view'] },
  { membershipType: 'Associate', priority: 50, keys: ['members.view','events.view','board.view'] },
  { membershipType: 'Honorary', priority: 50, keys: ['members.view','events.view','board.view','reports.view'] },
  { membershipType: 'Prospective', priority: 50, keys: ['events.view'] },
];

const positionRuleSets = [
  { position: 'President', scope: 'Global', priority: 80, keys: ['members.view','members.manage','board.view','board.manage','events.manage','finance.view','payments.approve','reports.view','reports.export','system.config'] },
  { position: 'Secretary', scope: 'Members', priority: 80, keys: ['members.view','members.manage','board.view','board.manage','events.manage','reports.view','data.import_export'] },
  { position: 'Honorary Treasurer', scope: 'Finance', priority: 80, keys: ['finance.view','finance.manage','payments.approve','reports.view','reports.export'] },
  { position: 'Executive Vice President', scope: 'Board', priority: 80, keys: ['members.view','board.view','board.manage','events.manage','reports.view'] },
  { position: 'Vice President', scope: 'Events', priority: 80, keys: ['members.view','board.view','events.view','events.manage','reports.view'] },
  { position: 'General Legal Council', scope: 'Board', priority: 80, keys: ['members.view','board.view','reports.view'] },
];

function docId(value) {
  return String(value).trim().replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
}

async function loadFirebase() {
  const serviceAccount = JSON.parse(await readFile(CREDENTIAL_PATH, 'utf8'));
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  return getFirestore();
}

async function main() {
  const db = await loadFirebase();
  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  const report = {
    generatedAt: new Date().toISOString(),
    collections: {
      permissionCatalog: permissions.length,
      userRolePermissions: 0,
      membershipTypePermissions: 0,
      positionPermissions: 0,
    },
  };

  for (const permission of permissions) {
    batch.set(db.collection('permissionCatalog').doc(permission.key), {
      ...permission,
      active: true,
      updatedAt: now,
    }, { merge: true });
  }

  for (const ruleSet of roleRuleSets) {
    for (const permissionKey of ruleSet.keys) {
      const id = docId(`${ruleSet.role}_${permissionKey}`);
      batch.set(db.collection('userRolePermissions').doc(id), {
        userRole: ruleSet.role,
        permissionKey,
        allowed: true,
        priority: ruleSet.priority,
        active: true,
        updatedAt: now,
      }, { merge: true });
      report.collections.userRolePermissions += 1;
    }
  }

  for (const ruleSet of membershipRuleSets) {
    for (const permissionKey of ruleSet.keys) {
      const id = docId(`${ruleSet.membershipType}_${permissionKey}`);
      batch.set(db.collection('membershipTypePermissions').doc(id), {
        membershipType: ruleSet.membershipType,
        permissionKey,
        allowed: true,
        priority: ruleSet.priority,
        active: true,
        updatedAt: now,
      }, { merge: true });
      report.collections.membershipTypePermissions += 1;
    }
  }

  for (const ruleSet of positionRuleSets) {
    for (const permissionKey of ruleSet.keys) {
      const id = docId(`${ruleSet.position}_${permissionKey}`);
      batch.set(db.collection('positionPermissions').doc(id), {
        position: ruleSet.position,
        scope: ruleSet.scope,
        permissionKey,
        allowed: true,
        priority: ruleSet.priority,
        active: true,
        updatedAt: now,
      }, { merge: true });
      report.collections.positionPermissions += 1;
    }
  }

  await batch.commit();
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log('Firebase permission rules seeded.');
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(`Firebase permission seed failed: ${error.message}`);
  process.exitCode = 1;
});

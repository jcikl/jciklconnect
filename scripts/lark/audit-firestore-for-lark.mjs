#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { BASE_SCHEMA } from './jcikl-base-schema.mjs';

const OUTPUT = resolve(process.cwd(), 'lark-migration-inventory.json');
const credentialPath = resolve(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  (await fileExists(resolve(process.cwd(), 'serviceAccountKey.json'))
    ? 'serviceAccountKey.json'
    : 'serviceAccount.json'),
);

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

function valueType(value) {
  if (value === null) return 'null';
  if (value instanceof Timestamp || value instanceof Date) return 'datetime';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'object') return 'object';
  return typeof value;
}

function addCount(target, key) {
  target[key] = (target[key] || 0) + 1;
}

function inspectDocuments(snapshot) {
  const fields = {};
  let withLoId = 0;
  let withoutLoId = 0;

  for (const document of snapshot.docs) {
    const data = document.data();
    if (typeof data.loId === 'string' && data.loId.trim()) withLoId += 1;
    else withoutLoId += 1;

    for (const [name, value] of Object.entries(data)) {
      fields[name] ||= { present: 0, types: {} };
      fields[name].present += 1;
      addCount(fields[name].types, valueType(value));
    }
  }

  return {
    count: snapshot.size,
    withLoId,
    withoutLoId,
    fields: Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))),
  };
}

async function main() {
  if (!(await fileExists(credentialPath))) {
    throw new Error(`Firebase service account not found: ${credentialPath}`);
  }

  const serviceAccount = JSON.parse(await readFile(credentialPath, 'utf8'));
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount) });
  const db = getFirestore();

  const collectionNames = [...new Set(
    BASE_SCHEMA.tables
      .flatMap((table) => table.sourceCollections)
      .filter((source) => !source.includes('[]')),
  )];

  const report = {
    generatedAt: new Date().toISOString(),
    firebaseProjectId: serviceAccount.project_id || null,
    privacy: 'Counts, field names, and value types only. No document values are included.',
    collections: {},
    derived: {},
    summary: { collections: collectionNames.length, documents: 0 },
  };

  console.log(`Auditing ${collectionNames.length} Firestore collections (read-only)...`);
  for (const name of collectionNames) {
    const snapshot = await db.collection(name).get();
    report.collections[name] = inspectDocuments(snapshot);
    report.summary.documents += snapshot.size;
    console.log(`- ${name}: ${snapshot.size}`);
  }

  const projects = await db.collection('projects').get();
  let committeeEntries = 0;
  let projectsWithCommittee = 0;
  for (const document of projects.docs) {
    const committee = document.data().committee;
    if (!Array.isArray(committee) || committee.length === 0) continue;
    projectsWithCommittee += 1;
    committeeEntries += committee.length;
  }
  report.derived.projectCommittee = { projectsWithCommittee, entries: committeeEntries };

  await writeFile(OUTPUT, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`\nAudit complete. No data was changed.`);
  console.log(`Report: ${OUTPUT}`);
  console.log(`Documents inspected: ${report.summary.documents}`);
  console.log(`Derived committee entries: ${committeeEntries}`);
}

main().catch((error) => {
  console.error(`Audit failed: ${error.message}`);
  process.exitCode = 1;
});

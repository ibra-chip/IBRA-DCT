import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(root, 'data.json');
const prisma = new PrismaClient();

const asDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? undefined : date;
};

const requiredDate = (value, fallback = new Date()) => asDate(value) ?? fallback;

const roleNameFor = (role) => {
  if (role === 'manager') return 'manager';
  if (role === 'admin') return 'admin';
  if (role === 'gerant') return 'gerant';
  if (role === 'worker') return 'worker';
  return 'user';
};

const uniqueRoleNames = (users) => [...new Set(users.map((user) => roleNameFor(user.role)))]
  .sort((first, second) => first.localeCompare(second));

const sourceCountsFor = (source) => ({
  companies: 1,
  roles: uniqueRoleNames(source.users ?? []).length,
  users: (source.users ?? []).length,
  projects: (source.projects ?? []).length,
  projectMembers: (source.users ?? []).reduce((sum, user) => sum + (user.projectIds ?? []).length, 0),
  documents: (source.documents ?? []).length,
  documentBytes: (source.documents ?? []).reduce((sum, document) => sum + Number(document.size || 0), 0),
  budgets: (source.projectBudgets ?? []).length,
  schedules: (source.projectSchedules ?? []).length,
  delays: (source.projectDelays ?? []).length,
  purchases: (source.purchases ?? []).length,
  controls: (source.chantierControls ?? []).length,
  controlHistory: (source.controlHistory ?? []).length,
  messages: (source.messages ?? []).length,
  rendezvous: (source.rendezvous ?? []).length,
  timeEntries: (source.timeEntries ?? []).length,
  payoutRequests: (source.payoutRequests ?? []).length,
  passwordResets: (source.passwordResets ?? []).length,
  unsupportedComplianceDocuments: (source.complianceDocuments ?? []).length,
});

async function migrate() {
  const source = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const company = await prisma.company.upsert({
    where: { id: 'legacy-ibra-company' },
    update: { name: 'IBRA-BA Legacy Company', status: 'active' },
    create: { id: 'legacy-ibra-company', name: 'IBRA-BA Legacy Company', status: 'active' },
  });
  const usersByLegacyId = new Map();
  const projectsByLegacyId = new Map();

  for (const sourceUser of source.users ?? []) {
    const roleName = roleNameFor(sourceUser.role);
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName, description: roleName },
    });
    const email = String(sourceUser.email || `${sourceUser.id}@legacy.ibra-ba.local`).toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: sourceUser.name || email,
        phone: sourceUser.phone || null,
        passwordHash: sourceUser.passwordHash,
        dailyRate: Number(sourceUser.dailyRate || 0),
        hourlyRate: Number(sourceUser.hourlyRate || 0),
        companyId: company.id,
        roleId: role.id,
        status: 'active',
      },
      create: {
        id: sourceUser.id,
        name: sourceUser.name || email,
        email,
        phone: sourceUser.phone || null,
        passwordHash: sourceUser.passwordHash,
        dailyRate: Number(sourceUser.dailyRate || 0),
        hourlyRate: Number(sourceUser.hourlyRate || 0),
        companyId: company.id,
        roleId: role.id,
      },
    });
    usersByLegacyId.set(sourceUser.id, user);
  }

  for (const sourceProject of source.projects ?? []) {
    const manager = [...usersByLegacyId.values()].find((user) => user.name === sourceProject.manager);
    const project = await prisma.project.upsert({
      where: { id: sourceProject.id },
      update: {
        name: sourceProject.name,
        location: sourceProject.location || null,
        status: sourceProject.status || 'planning',
        progress: Number(sourceProject.progress || 0),
        managerId: manager?.id ?? null,
        companyId: company.id,
      },
      create: {
        id: sourceProject.id,
        name: sourceProject.name,
        location: sourceProject.location || null,
        status: sourceProject.status || 'planning',
        progress: Number(sourceProject.progress || 0),
        managerId: manager?.id ?? null,
        companyId: company.id,
      },
    });
    projectsByLegacyId.set(sourceProject.id, project);

    for (const sourceUser of source.users ?? []) {
      if (!(sourceUser.projectIds ?? []).includes(sourceProject.id)) continue;
      const user = usersByLegacyId.get(sourceUser.id);
      if (!user) continue;
      const role = await prisma.role.findUnique({ where: { name: roleNameFor(sourceUser.role) } });
      await prisma.projectMember.upsert({
        where: { projectId_userId: { projectId: project.id, userId: user.id } },
        update: { status: 'active', roleId: role?.id ?? null },
        create: { projectId: project.id, userId: user.id, status: 'active', roleId: role?.id ?? null },
      });
    }
  }

  for (const budget of source.projectBudgets ?? []) {
    const project = projectsByLegacyId.get(budget.projectId);
    if (!project) continue;
    await prisma.projectBudget.upsert({
      where: { projectId: project.id },
      update: {
        chantierName: budget.chantierName || null,
        devisNumber: budget.devisNumber || null,
        client: budget.client || null,
        total: Number(budget.total || 0),
        spent: Number(budget.spent || 0),
        remaining: Number(budget.remaining || 0),
        sourceFile: budget.sourceFile || null,
        sourceName: budget.sourceName || null,
        status: budget.status || 'uploaded',
        uploadedBy: budget.uploadedBy || null,
      },
      create: {
        projectId: project.id,
        chantierName: budget.chantierName || null,
        devisNumber: budget.devisNumber || null,
        client: budget.client || null,
        total: Number(budget.total || 0),
        spent: Number(budget.spent || 0),
        remaining: Number(budget.remaining || 0),
        sourceFile: budget.sourceFile || null,
        sourceName: budget.sourceName || null,
        status: budget.status || 'uploaded',
        uploadedBy: budget.uploadedBy || null,
      },
    });
  }

  for (const schedule of source.projectSchedules ?? []) {
    const project = projectsByLegacyId.get(schedule.projectId);
    if (!project) continue;
    await prisma.projectSchedule.upsert({
      where: { projectId: project.id },
      update: {
        startDate: asDate(schedule.startDate),
        plannedEndDate: asDate(schedule.plannedEndDate),
        adjustedEndDate: asDate(schedule.adjustedEndDate),
        updatedBy: schedule.updatedBy || null,
        updatedAt: requiredDate(schedule.updatedAt),
      },
      create: {
        projectId: project.id,
        startDate: asDate(schedule.startDate),
        plannedEndDate: asDate(schedule.plannedEndDate),
        adjustedEndDate: asDate(schedule.adjustedEndDate),
        updatedBy: schedule.updatedBy || null,
        updatedAt: requiredDate(schedule.updatedAt),
      },
    });
  }

  for (const delay of source.projectDelays ?? []) {
    const project = projectsByLegacyId.get(delay.projectId);
    if (!project) continue;
    await prisma.projectDelay.upsert({
      where: { id: delay.id },
      update: { days: Number(delay.days || 0), reason: delay.reason || null, createdBy: delay.createdBy || null, createdAt: requiredDate(delay.createdAt) },
      create: { id: delay.id, projectId: project.id, days: Number(delay.days || 0), reason: delay.reason || null, createdBy: delay.createdBy || null, createdAt: requiredDate(delay.createdAt) },
    });
  }

  for (const control of source.chantierControls ?? []) {
    const project = projectsByLegacyId.get(control.projectId);
    if (!project) continue;
    await prisma.chantierControl.upsert({
      where: { id: control.id },
      update: { name: control.name, status: control.status || 'review', owner: control.owner || null, updatedBy: control.updatedBy || null },
      create: { id: control.id, projectId: project.id, name: control.name, status: control.status || 'review', owner: control.owner || null, updatedBy: control.updatedBy || null, updatedAt: requiredDate(control.updatedAt) },
    });
  }

  for (const history of source.controlHistory ?? []) {
    const project = projectsByLegacyId.get(history.projectId);
    if (!project) continue;
    await prisma.controlHistory.upsert({
      where: { id: history.id },
      update: { from: history.from, to: history.to, changedBy: history.changedBy, changedAt: requiredDate(history.changedAt) },
      create: { id: history.id, projectId: project.id, controlId: history.controlId, from: history.from, to: history.to, changedBy: history.changedBy, changedAt: requiredDate(history.changedAt) },
    });
  }

  for (const purchase of source.purchases ?? []) {
    const project = projectsByLegacyId.get(purchase.projectId);
    if (!project) continue;
    await prisma.purchase.upsert({
      where: { id: purchase.id },
      update: {
        createdBy: purchase.createdBy,
        category: purchase.category || 'other',
        supplier: purchase.supplier || '',
        description: purchase.description || '',
        amount: Number(purchase.amount || 0),
        purchaseDate: requiredDate(purchase.purchaseDate || purchase.date),
        invoiceKey: purchase.invoiceKey || purchase.invoiceStoredName || null,
        invoiceName: purchase.invoiceName || purchase.invoiceOriginalName || null,
      },
      create: {
        id: purchase.id,
        projectId: project.id,
        createdBy: purchase.createdBy,
        category: purchase.category || 'other',
        supplier: purchase.supplier || '',
        description: purchase.description || '',
        amount: Number(purchase.amount || 0),
        purchaseDate: requiredDate(purchase.purchaseDate || purchase.date),
        invoiceKey: purchase.invoiceKey || purchase.invoiceStoredName || null,
        invoiceName: purchase.invoiceName || purchase.invoiceOriginalName || null,
        createdAt: requiredDate(purchase.createdAt),
      },
    });
  }

  for (const message of source.messages ?? []) {
    const project = projectsByLegacyId.get(message.projectId);
    if (!project) continue;
    const createdAt = requiredDate(message.createdAt);
    await prisma.message.upsert({
      where: { id: message.id },
      update: { senderId: message.senderId, recipientId: message.recipientId, text: message.text || '', readAt: message.read ? createdAt : asDate(message.readAt) },
      create: { id: message.id, projectId: project.id, senderId: message.senderId, recipientId: message.recipientId, text: message.text || '', readAt: message.read ? createdAt : asDate(message.readAt), createdAt },
    });
  }

  for (const rendezvous of source.rendezvous ?? []) {
    const project = projectsByLegacyId.get(rendezvous.projectId);
    if (!project) continue;
    await prisma.rendezvous.upsert({
      where: { id: rendezvous.id },
      update: { workerId: rendezvous.workerId, ownerId: rendezvous.ownerId || null, absenceDate: requiredDate(rendezvous.absenceDate || rendezvous.date), time: rendezvous.time || '', reason: rendezvous.reason || '', status: rendezvous.status || 'pending' },
      create: { id: rendezvous.id, projectId: project.id, workerId: rendezvous.workerId, ownerId: rendezvous.ownerId || null, absenceDate: requiredDate(rendezvous.absenceDate || rendezvous.date), time: rendezvous.time || '', reason: rendezvous.reason || '', status: rendezvous.status || 'pending', createdAt: requiredDate(rendezvous.createdAt) },
    });
  }

  for (const entry of source.timeEntries ?? []) {
    const project = projectsByLegacyId.get(entry.projectId);
    if (!project) continue;
    await prisma.timeEntry.upsert({
      where: { id: entry.id },
      update: { workerId: entry.workerId, date: requiredDate(entry.date), start: entry.start || '', end: entry.end || '', breakMinutes: Number(entry.breakMinutes || 0), hours: Number(entry.hours || 0), rateType: entry.rateType || 'daily', rate: Number(entry.rate || 0), workAmount: Number(entry.workAmount || 0), status: entry.status || 'pending', approvedBy: entry.approvedBy || null },
      create: { id: entry.id, projectId: project.id, workerId: entry.workerId, date: requiredDate(entry.date), start: entry.start || '', end: entry.end || '', breakMinutes: Number(entry.breakMinutes || 0), hours: Number(entry.hours || 0), rateType: entry.rateType || 'daily', rate: Number(entry.rate || 0), workAmount: Number(entry.workAmount || 0), status: entry.status || 'pending', approvedBy: entry.approvedBy || null, createdAt: requiredDate(entry.createdAt) },
    });
  }

  for (const payout of source.payoutRequests ?? []) {
    await prisma.payoutRequest.upsert({
      where: { id: payout.id },
      update: { userId: payout.userId, month: payout.month || '', amount: Number(payout.amount || 0), status: payout.status || 'pending', reviewedBy: payout.reviewedBy || null },
      create: { id: payout.id, userId: payout.userId, month: payout.month || '', amount: Number(payout.amount || 0), status: payout.status || 'pending', reviewedBy: payout.reviewedBy || null, createdAt: requiredDate(payout.createdAt) },
    });
  }

  for (const reset of source.passwordResets ?? []) {
    await prisma.passwordReset.upsert({
      where: { id: reset.id },
      update: { userId: reset.userId, token: reset.token, expiresAt: requiredDate(reset.expiresAt) },
      create: { id: reset.id, userId: reset.userId, token: reset.token, expiresAt: requiredDate(reset.expiresAt), createdAt: requiredDate(reset.createdAt) },
    });
  }

  for (const document of source.documents ?? []) {
    const project = projectsByLegacyId.get(document.projectId);
    if (!project) continue;
    await prisma.document.upsert({
      where: { id: document.id },
      update: {
        uploadedBy: document.uploadedBy,
        title: document.originalName || document.storedName,
        fileName: document.originalName || document.storedName,
        originalName: document.originalName || null,
        storageKey: document.storedName,
        mimeType: document.mimeType || 'application/octet-stream',
        size: Number(document.size || 0),
        evidenceType: document.evidenceType || null,
        phase: document.phase || null,
        category: document.evidenceType || 'general',
      },
      create: {
        id: document.id,
        projectId: project.id,
        uploadedBy: document.uploadedBy,
        title: document.originalName || document.storedName,
        fileName: document.originalName || document.storedName,
        originalName: document.originalName || null,
        storageKey: document.storedName,
        mimeType: document.mimeType || 'application/octet-stream',
        size: Number(document.size || 0),
        evidenceType: document.evidenceType || null,
        phase: document.phase || null,
        category: document.evidenceType || 'general',
        createdAt: requiredDate(document.uploadedAt),
      },
    });
  }

  const sourceCounts = sourceCountsFor(source);
  const importedCounts = {
    companies: await prisma.company.count({ where: { id: company.id } }),
    roles: await prisma.role.count({ where: { name: { in: uniqueRoleNames(source.users ?? []) } } }),
    users: await prisma.user.count({ where: { companyId: company.id } }),
    projects: await prisma.project.count({ where: { companyId: company.id } }),
    projectMembers: await prisma.projectMember.count({ where: { project: { companyId: company.id } } }),
    documents: await prisma.document.count({ where: { project: { companyId: company.id } } }),
    budgets: await prisma.projectBudget.count({ where: { project: { companyId: company.id } } }),
    schedules: await prisma.projectSchedule.count({ where: { project: { companyId: company.id } } }),
    delays: await prisma.projectDelay.count({ where: { project: { companyId: company.id } } }),
    purchases: await prisma.purchase.count({ where: { project: { companyId: company.id } } }),
    controls: await prisma.chantierControl.count({ where: { project: { companyId: company.id } } }),
    controlHistory: await prisma.controlHistory.count({ where: { project: { companyId: company.id } } }),
    messages: await prisma.message.count({ where: { project: { companyId: company.id } } }),
    rendezvous: await prisma.rendezvous.count({ where: { project: { companyId: company.id } } }),
    timeEntries: await prisma.timeEntry.count({ where: { project: { companyId: company.id } } }),
    payoutRequests: await prisma.payoutRequest.count({ where: { userId: { in: [...usersByLegacyId.values()].map((user) => user.id) } } }),
    passwordResets: await prisma.passwordReset.count({ where: { userId: { in: [...usersByLegacyId.values()].map((user) => user.id) } } }),
  };
  const reconciliationKeys = Object.keys(importedCounts);
  const missing = Object.fromEntries(reconciliationKeys
    .filter((key) => importedCounts[key] < sourceCounts[key])
    .map((key) => [key, { source: sourceCounts[key], imported: importedCounts[key] }]));
  const report = {
    generatedAt: new Date().toISOString(),
    sourceFile: 'data.json',
    target: process.env.MIGRATION_TARGET || 'staging',
    companyId: company.id,
    source: sourceCounts,
    imported: importedCounts,
    unsupported: { complianceDocuments: sourceCounts.unsupportedComplianceDocuments },
    missing,
    status: Object.keys(missing).length || sourceCounts.unsupportedComplianceDocuments ? 'attention_required' : 'reconciled',
    storage: {
      sourceDocumentBytes: sourceCounts.documentBytes,
      documentMetadataImported: sourceCounts.documents,
      binaryObjectsCopied: 0,
      note: 'Copy legacy uploads to private Supabase Storage and reconcile storageKey before enabling production document reads.',
    },
  };
  const requestedReportPath = process.env.MIGRATION_REPORT_PATH || `migration-reports/data-migration-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const reportPath = path.isAbsolute(requestedReportPath) ? requestedReportPath : path.join(root, requestedReportPath);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  console.log(`reconciliation report: ${reportPath}`);
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

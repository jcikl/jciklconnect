// Reconciliation Service - Auto-matching & splitting bank transactions with project transactions
import { Transaction, TransactionSplit } from '../types';
import { FinanceService } from './financeService';

export interface MatchResult {
  bankTxId: string;
  projectTxIds: string[];
  allocations: Array<{ projectTxId: string; amount: number }>;
  remainder: number;
  confidence: 'high' | 'medium' | 'low';
  needsSplit: boolean;
}

export interface ReconciliationSummary {
  matched: number;
  splitCreated: number;
  remainderSplits: number;
  skipped: number;
  errors: string[];
}

/**
 * Computes how much of a project transaction's amount is already covered
 * by existing bank transaction links.
 */
function computeRemainingAmount(
  projectTx: Transaction,
  bankTransactions: Transaction[],
  excludeBankTxId?: string
): number {
  const total = Math.abs(projectTx.amount);
  const matched = bankTransactions.reduce((sum, btx) => {
    if (excludeBankTxId && btx.id === excludeBankTxId) return sum;
    const linkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
    if (linkedIds.includes(projectTx.id)) {
      return sum + Math.abs(btx.amount);
    }
    return sum;
  }, 0);
  return Math.max(0, total - matched);
}

function getLevenshteinDistance(s1: string, s2: string): number {
  const len1 = s1.length;
  const len2 = s2.length;
  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[len1][len2];
}

function getSortedCleanWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[*,.\-_#()]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => {
      if (w.length <= 1) return false;
      const noise = [
        'mbb', 'ct', 'transfer', 'fund', 'duitnow', 'qr', 
        'gelblaster', 'gelball', 'paid', 'behalf', 'pay',
        'from', 'sport', 'jci', 'kl', 'jcilt', 'claim'
      ];
      return !noise.includes(w);
    });
}

function getMemberNames(member: any): string[] {
  const names = new Set<string>();
  if (member.name) names.add(member.name.trim().toLowerCase());
  if (member.fullName) names.add(member.fullName.trim().toLowerCase());
  if (member.chiName) names.add(member.chiName.trim().toLowerCase());
  if (member.general) {
    if (member.general.name) names.add(member.general.name.trim().toLowerCase());
    if (member.general.chineseName) names.add(member.general.chineseName.trim().toLowerCase());
  }
  if (member.others) {
    if (member.others.embroideredName) names.add(member.others.embroideredName.trim().toLowerCase());
  }
  return Array.from(names).filter(Boolean);
}

function getMemberIdentifiers(member: any): string[] {
  const ids = new Set<string>();
  if (member.idNumber) ids.add(member.idNumber.trim().toLowerCase().replace(/[\s\-]/g, ''));
  if (member.phone) ids.add(member.phone.trim().replace(/[+\s\-()]/g, ''));
  if (member.general) {
    if (member.general.idNumber) ids.add(member.general.idNumber.trim().toLowerCase().replace(/[\s\-]/g, ''));
  }
  if (member.contact) {
    if (member.contact.phone) ids.add(member.contact.phone.trim().replace(/[+\s\-()]/g, ''));
  }
  return Array.from(ids).filter(Boolean);
}

function getStringSimilarity(s1: string, s2: string): number {
  const str1 = s1.trim().toLowerCase();
  const str2 = s2.trim().toLowerCase();
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;

  // 1. Word-level sorted exact match (e.g. "Lee Nang" and "Nang Lee")
  const w1 = getSortedCleanWords(str1).sort();
  const w2 = getSortedCleanWords(str2).sort();
  if (w1.length > 0 && w2.length > 0) {
    const w1Str = w1.join(' ');
    const w2Str = w2.join(' ');
    if (w1Str === w2Str) return 1.0;

    // Check subset of words (e.g. "Wong Yap Shin Loong" vs "Shin Loong")
    const intersection = w1.filter(w => w2.includes(w));
    const minLen = Math.min(w1.length, w2.length);
    if (intersection.length >= minLen && minLen >= 2) {
      return 0.95; // very high confidence word subset match
    }
  }

  // 2. Check substring contains (gives a boost if one is completely inside another)
  if (str1.includes(str2) || str2.includes(str1)) {
    return 0.8 + 0.2 * (Math.min(str1.length, str2.length) / Math.max(str1.length, str2.length));
  }

  const maxLen = Math.max(str1.length, str2.length);
  const distance = getLevenshteinDistance(str1, str2);
  return (maxLen - distance) / maxLen;
}

/**
 * Computes a score based on date closeness between a project transaction and a bank transaction.
 * Returns an exponential decay score from 0.0 to 1.0.
 * Returns 0.9 for undated transactions (payment requests).
 * Returns -1.0 if dates are more than the allowed threshold apart.
 */
function getDateClosenessScore(pDateStr: string | undefined, bankDateStr: string, hasStrongTextMatch: boolean): number {
  if (!pDateStr) return 0.9;
  try {
    const pDate = new Date(pDateStr);
    const bDate = new Date(bankDateStr);
    if (isNaN(pDate.getTime()) || isNaN(bDate.getTime())) return 0.9;

    const diffMs = Math.abs(bDate.getTime() - pDate.getTime());
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    const limitDays = hasStrongTextMatch ? 180 : 90;
    if (diffDays > limitDays) {
      return -1.0; // Too far, exclude
    }

    // Exponential decay: 0 days = 1.0, 5 days = 0.77, 10 days = 0.60
    // Capped at 0.5 floor for strong matches to prevent date penalty from overriding high-confidence text matches
    const decay = Math.exp(-0.05 * diffDays);
    return hasStrongTextMatch ? Math.max(0.5, decay) : decay;
  } catch {
    return 0.9;
  }
}

function computeMatchStatus(remaining: number, total: number): 'unmatched' | 'partial' | 'full' | 'over' {
  if (remaining >= total - 0.01) return 'unmatched';
  if (remaining <= 0.01) return 'full';
  if (remaining < 0) return 'over';
  return 'partial';
}

export class ReconciliationService {

  /**
   * Analyze and produce match candidates without writing anything.
   */
  static analyzeMatches(
    bankTransactions: Transaction[],
    projectTransactions: Transaction[],
    members: any[] = []
  ): MatchResult[] {
    const results: MatchResult[] = [];

    // Only consider unmatched bank transactions
    const unmatchedBankTxs = bankTransactions.filter(btx => {
      const linkedIds = (btx as any).projectTransactionIds || ((btx as any).projectTransactionId ? [(btx as any).projectTransactionId] : []);
      return linkedIds.length === 0 && !btx.isSplit;
    });

    // Track which project txs are still available (clone for mutation)
    const availableProjectTxs = projectTransactions.map(p => ({
      ...p,
      _remaining: computeRemainingAmount(p, bankTransactions),
    }));

    // Sort bank txs by amount descending for greedy matching
    const sortedBank = [...unmatchedBankTxs].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    for (const bankTx of sortedBank) {
      const bankAmount = Math.abs(bankTx.amount);

      // Filter and score candidates: same type, has remaining amount, and within date range (score >= 0)
      const candidates = availableProjectTxs
        .filter(p => p.type === bankTx.type && p._remaining > 0.01)
        .map(p => {
          const refSim = getStringSimilarity(p.referenceNumber || '', bankTx.referenceNumber || '');
          const descSim = getStringSimilarity(p.description || '', bankTx.description || '');
          let textSim = Math.max(refSim, descSim);

          // Member name cross-referencing (intermediate reference matching)
          let hasMemberNameMatch = false;
          if (members && members.length > 0) {
            let mNames: string[] = [];
            let mIdentifiers: string[] = [];
            // Case 1: Project transaction is explicitly linked to a memberId
            if (p.memberId) {
              const mObj = members.find((m: any) => m.id === p.memberId);
              if (mObj) {
                mNames = getMemberNames(mObj);
                mIdentifiers = getMemberIdentifiers(mObj);
              }
            }
            // Case 2: Project transaction description/reference contains a member's name
            else {
              const pDesc = (p.description || '').toLowerCase();
              const pRef = (p.referenceNumber || '').toLowerCase();
              const mObj = members.find((m: any) => {
                const names = getMemberNames(m);
                return names.some(name => pDesc.includes(name) || pRef.includes(name));
              });
              if (mObj) {
                mNames = getMemberNames(mObj);
                mIdentifiers = getMemberIdentifiers(mObj);
              }
            }

            // Check name and identifiers in the bank transaction
            const bDesc = (bankTx.description || '').toLowerCase();
            const bRef = (bankTx.referenceNumber || '').toLowerCase();

            const nameMatch = mNames.length > 0 && mNames.some(name => 
              bDesc.includes(name) || 
              bRef.includes(name) || 
              getStringSimilarity(name, bDesc) >= 0.75 || 
              getStringSimilarity(name, bRef) >= 0.75
            );

            const identifierMatch = mIdentifiers.length > 0 && mIdentifiers.some(id => 
              bDesc.includes(id) || 
              bRef.includes(id)
            );

            hasMemberNameMatch = nameMatch || identifierMatch;
          }

          if (hasMemberNameMatch) {
            textSim = Math.max(textSim, 0.95); // High confidence boost
          }

          const hasStrongTextMatch = textSim >= 0.75 || hasMemberNameMatch;
          const dateScore = getDateClosenessScore(p.date, bankTx.date, hasStrongTextMatch);

          return {
            ...p,
            _dateScore: dateScore,
            _textSim: textSim,
            _hasMemberNameMatch: hasMemberNameMatch,
          };
        })
        .filter(p => p._dateScore >= 0);

      if (candidates.length === 0) continue;

      // Priority 1: Exact 1:1 match by amount + ref matching
      const p1Candidates = candidates
        .filter(p => {
          if (Math.abs(p._remaining - bankAmount) > 0.01) return false;
          const pRef = (p.referenceNumber || '').trim().toLowerCase();
          const bRef = (bankTx.referenceNumber || '').trim().toLowerCase();
          const hasRefMatch = pRef && bRef && (pRef.includes(bRef) || bRef.includes(pRef) || getStringSimilarity(pRef, bRef) >= 0.6);
          return !!hasRefMatch;
        })
        .map(p => ({
          ...p,
          _matchScore: p._textSim * 0.6 + p._dateScore * 0.4
        }))
        .sort((a, b) => b._matchScore - a._matchScore);

      if (p1Candidates.length > 0) {
        const bestMatch = p1Candidates[0];
        const orig = availableProjectTxs.find(x => x.id === bestMatch.id);
        if (orig) orig._remaining = 0;

        results.push({
          bankTxId: bankTx.id,
          projectTxIds: [bestMatch.id],
          allocations: [{ projectTxId: bestMatch.id, amount: bankAmount }],
          remainder: 0,
          confidence: 'high',
          needsSplit: false,
        });
        continue;
      }

      // Priority 2: Exact 1:1 match by amount + description matching (or member name matching)
      const p2Candidates = candidates
        .filter(p => {
          if (Math.abs(p._remaining - bankAmount) > 0.01) return false;
          const pDesc = (p.description || '').trim().toLowerCase();
          const bDesc = (bankTx.description || '').trim().toLowerCase();
          const hasDescMatch = (pDesc && bDesc && (pDesc.includes(bDesc) || bDesc.includes(pDesc) || getStringSimilarity(pDesc, bDesc) >= 0.5)) || p._hasMemberNameMatch;
          return !!hasDescMatch;
        })
        .map(p => ({
          ...p,
          _matchScore: p._textSim * 0.6 + p._dateScore * 0.4
        }))
        .sort((a, b) => b._matchScore - a._matchScore);

      if (p2Candidates.length > 0) {
        const bestMatch = p2Candidates[0];
        const orig = availableProjectTxs.find(x => x.id === bestMatch.id);
        if (orig) orig._remaining = 0;

        results.push({
          bankTxId: bankTx.id,
          projectTxIds: [bestMatch.id],
          allocations: [{ projectTxId: bestMatch.id, amount: bankAmount }],
          remainder: 0,
          confidence: 'high',
          needsSplit: false,
        });
        continue;
      }

      // Priority 3: Exact 1:1 match by amount + partial text similarity threshold
      const p3Candidates = candidates
        .filter(p => Math.abs(p._remaining - bankAmount) <= 0.01 && (p._textSim >= 0.35 || p._hasMemberNameMatch))
        .sort((a, b) => b._dateScore - a._dateScore);

      if (p3Candidates.length > 0) {
        const bestMatch = p3Candidates[0];
        const orig = availableProjectTxs.find(x => x.id === bestMatch.id);
        if (orig) orig._remaining = 0;

        results.push({
          bankTxId: bankTx.id,
          projectTxIds: [bestMatch.id],
          allocations: [{ projectTxId: bestMatch.id, amount: bankAmount }],
          remainder: 0,
          confidence: 'medium',
          needsSplit: false,
        });
        continue;
      }
    }

    return results;
  }

  /**
   * Execute auto-match: create splits where needed, update links, update reverse indexes.
   */
  static async executeAutoMatch(
    matches: MatchResult[],
    bankTransactions: Transaction[],
    projectTransactions: Transaction[],
    projectId: string,
    userId: string = 'current-user'
  ): Promise<ReconciliationSummary> {
    const summary: ReconciliationSummary = {
      matched: 0, splitCreated: 0, remainderSplits: 0, skipped: 0, errors: [],
    };

    for (const match of matches) {
      try {
        const bankTx = bankTransactions.find(b => b.id === match.bankTxId);
        if (!bankTx) { summary.skipped++; continue; }

        if (match.needsSplit) {
          const isSplitChild = (bankTx as any).isSplitChild;
          const parentTxId = isSplitChild ? (bankTx as any).parentTransactionId : bankTx.id;

          if (!parentTxId) {
            throw new Error('Parent transaction ID not found for transaction split');
          }

          // Build split array
          const newSplits: Array<{
            category: 'Projects & Activities' | 'Membership' | 'Administrative';
            projectId?: string;
            memberId?: string;
            amount: number;
            description: string;
            purpose?: string;
            projectTransactionIds?: string[];
          }> = [];

          for (const alloc of match.allocations) {
            const pTx = projectTransactions.find(p => p.id === alloc.projectTxId);
            newSplits.push({
              category: 'Projects & Activities',
              projectId,
              memberId: '',
              amount: alloc.amount,
              description: pTx?.description || bankTx.description || '',
              purpose: pTx?.purpose || '',
              projectTransactionIds: [alloc.projectTxId],
            });
          }

          if (match.remainder > 0.01) {
            newSplits.push({
              category: 'Projects & Activities',
              projectId,
              memberId: '',
              amount: match.remainder,
              description: 'Unallocated Balance / 未分配余额',
              purpose: 'Pending allocation',
            });
            summary.remainderSplits++;
          }

          let allSplits = [];
          let otherSplits: any[] = [];
          if (isSplitChild) {
            // Fetch parent's existing splits
            const existingSplits = await FinanceService.getTransactionSplits(parentTxId);
            // Keep other splits, replace this one
            otherSplits = existingSplits.filter(s => s.id !== bankTx.id);
            allSplits = [...otherSplits, ...newSplits];
          } else {
            allSplits = newSplits;
          }

          // Use FinanceService to create the splits
          const splitIds = await FinanceService.createTransactionSplit(
            parentTxId,
            allSplits.map(s => ({
              ...s,
              category: s.category as any,
            })),
            userId
          );

          // After split creation, update each split with projectTransactionIds
          const newlyCreatedIds = splitIds.slice(otherSplits.length);
          for (let i = 0; i < match.allocations.length && i < newlyCreatedIds.length; i++) {
            const splitId = newlyCreatedIds[i];
            const alloc = match.allocations[i];
            if (splitId && alloc) {
              await FinanceService.updateTransactionSplit(splitId, {
                projectTransactionIds: [alloc.projectTxId],
                projectTransactionId: alloc.projectTxId,
                autoGenerated: true,
              } as any);
            }
          }

          // Mark remainder split as autoGenerated if it exists
          if (match.remainder > 0.01 && newlyCreatedIds.length > match.allocations.length) {
            const remainderSplitId = newlyCreatedIds[newlyCreatedIds.length - 1];
            await FinanceService.updateTransactionSplit(remainderSplitId, {
              autoGenerated: true,
            } as any);
          }

          summary.splitCreated++;
        } else {
          // Simple 1:1 link - no split needed
          const pTxId = match.projectTxIds[0];
          const pTx = projectTransactions.find(p => p.id === pTxId);
          const isSplitChild = (bankTx as any).isSplitChild;

          const updates: any = {
            projectTransactionIds: [pTxId],
            projectTransactionId: pTxId,
            status: 'Reconciled',
          };
          if (pTx?.purpose) updates.purpose = pTx.purpose;

          if (isSplitChild) {
            await FinanceService.updateTransactionSplit(bankTx.id, updates);
          } else {
            await FinanceService.updateTransaction(bankTx.id, updates);
          }
        }

        summary.matched++;

        // Update reverse index on project transactions.
        // E3: errors here are captured in summary.errors (not swallowed) so the caller knows
        // which project transaction reverse-index updates failed and can surface them to finance.
        for (const alloc of match.allocations) {
          try {
            await this.updateProjectTxMatchStatus(
              alloc.projectTxId, match.bankTxId, alloc.amount, bankTransactions, projectTransactions
            );
          } catch (idxErr) {
            const msg = idxErr instanceof Error ? idxErr.message : String(idxErr);
            summary.errors.push(`ProjectTx ${alloc.projectTxId} reverse index update failed (Bank Tx ${match.bankTxId}): ${msg}`);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`Bank Tx ${match.bankTxId}: ${msg}`);
      }
    }

    return summary;
  }

  /**
   * Manual match: link a bank tx to one or more project txs, auto-split if needed.
   */
  static async manualMatch(
    bankTxId: string,
    projectTxIds: string[],
    bankTransactions: Transaction[],
    projectTransactions: Transaction[],
    projectId: string,
    userId: string = 'current-user'
  ): Promise<{ splitCreated: boolean; remainder: number }> {
    const bankTx = bankTransactions.find(b => b.id === bankTxId);
    if (!bankTx) throw new Error('Bank transaction not found');

    const bankAmount = Math.abs(bankTx.amount);

    if (projectTxIds.length === 0) {
      // Unlink all
      await this.unlinkMatch(bankTxId, undefined, bankTransactions, projectTransactions, projectId);
      return { splitCreated: false, remainder: 0 };
    }

    // Calculate allocations
    const allocations: Array<{ projectTxId: string; amount: number }> = [];
    let accumulated = 0;

    for (const pTxId of projectTxIds) {
      const pTx = projectTransactions.find(p => p.id === pTxId);
      if (!pTx) continue;
      const remaining = computeRemainingAmount(pTx, bankTransactions, bankTxId);
      const allocate = Math.min(remaining, bankAmount - accumulated);
      if (allocate > 0.01) {
        allocations.push({ projectTxId: pTxId, amount: allocate });
        accumulated += allocate;
      }
    }

    const remainder = Math.max(0, bankAmount - accumulated);
    const needsSplit = allocations.length > 1 || remainder > 0.01;

    if (needsSplit && !bankTx.isSplit) {
      const isSplitChild = (bankTx as any).isSplitChild;
      const parentTxId = isSplitChild ? (bankTx as any).parentTransactionId : bankTx.id;

      if (!parentTxId) {
        throw new Error('Parent transaction ID not found for transaction split');
      }

      // Create splits
      const newSplits: any[] = allocations.map(alloc => {
        const pTx = projectTransactions.find(p => p.id === alloc.projectTxId);
        return {
          category: 'Projects & Activities',
          projectId,
          memberId: '',
          amount: alloc.amount,
          description: pTx?.description || bankTx.description || '',
          purpose: pTx?.purpose || '',
        };
      });

      if (remainder > 0.01) {
        newSplits.push({
          category: 'Projects & Activities',
          projectId,
          memberId: '',
          amount: remainder,
          description: 'Unallocated Balance / 未分配余额',
          purpose: 'Pending allocation',
        });
      }

      let allSplits = [];
      let otherSplits: any[] = [];
      if (isSplitChild) {
        // Fetch parent's existing splits
        const existingSplits = await FinanceService.getTransactionSplits(parentTxId);
        // Keep other splits, replace this one
        otherSplits = existingSplits.filter(s => s.id !== bankTx.id);
        allSplits = [...otherSplits, ...newSplits];
      } else {
        allSplits = newSplits;
      }

      const splitIds = await FinanceService.createTransactionSplit(parentTxId, allSplits, userId);

      // Link splits to project txs
      const newlyCreatedIds = splitIds.slice(otherSplits.length);

      for (let i = 0; i < allocations.length && i < newlyCreatedIds.length; i++) {
        await FinanceService.updateTransactionSplit(newlyCreatedIds[i], {
          projectTransactionIds: [allocations[i].projectTxId],
          projectTransactionId: allocations[i].projectTxId,
          autoGenerated: true,
        } as any);
      }
      // Mark remainder split
      if (remainder > 0.01 && newlyCreatedIds.length > allocations.length) {
        await FinanceService.updateTransactionSplit(newlyCreatedIds[newlyCreatedIds.length - 1], {
          autoGenerated: true,
        } as any);
      }

      // Update parent bank tx status: Partially Reconciled if unlinked remainder exists, else Reconciled (情景 HH)
      const parentStatus: 'Reconciled' | 'Partially Reconciled' = remainder > 0.01 ? 'Partially Reconciled' : 'Reconciled';
      await FinanceService.updateTransaction(parentTxId, { status: parentStatus });
    } else if (!needsSplit) {
      // Simple 1:1 link
      const pTxId = projectTxIds[0];
      const pTx = projectTransactions.find(p => p.id === pTxId);
      const isSplitChild = (bankTx as any).isSplitChild;
      const updates: any = {
        projectTransactionIds: [pTxId],
        projectTransactionId: pTxId,
        status: 'Reconciled',
      };
      if (pTx?.purpose) updates.purpose = pTx.purpose;

      if (isSplitChild) {
        await FinanceService.updateTransactionSplit(bankTx.id, updates);
      } else {
        await FinanceService.updateTransaction(bankTx.id, updates);
      }
    }

    // Update reverse indexes
    for (const alloc of allocations) {
      await this.updateProjectTxMatchStatus(
        alloc.projectTxId, bankTxId, alloc.amount, bankTransactions, projectTransactions
      );
    }

    return { splitCreated: needsSplit, remainder };
  }

  /**
   * Unlink a bank transaction from project transactions.
   * If projectTxId is provided, partial unlink; otherwise full unlink.
   */
  static async unlinkMatch(
    bankTxId: string,
    projectTxId: string | undefined,
    bankTransactions: Transaction[],
    projectTransactions: Transaction[],
    projectId: string
  ): Promise<void> {
    const bankTx = bankTransactions.find(b => b.id === bankTxId);
    if (!bankTx) return;

    const isSplitChild = (bankTx as any).isSplitChild;

    if (bankTx.isSplit) {
      // Get all splits
      const splits = await FinanceService.getTransactionSplits(bankTxId);
      const autoSplits = splits.filter(s => (s as any).autoGenerated);

      if (autoSplits.length > 0) {
        // Delete auto-generated splits and restore parent
        for (const split of autoSplits) {
          // Update reverse index on linked project txs
          const linkedPTxIds = (split as any).projectTransactionIds || [];
          for (const pId of linkedPTxIds) {
            await this.removeProjectTxMatchEntry(pId, split.id, bankTransactions, projectTransactions);
          }
          await FinanceService.deleteTransactionSplit(split.id);
        }

        // Check if any non-auto splits remain
        const remainingSplits = splits.filter(s => !(s as any).autoGenerated);
        if (remainingSplits.length === 0) {
          // All splits were auto — parent is now restored by deleteTransactionSplit logic
        }
      } else {
        // Manual splits — just clear projectTransactionIds on relevant splits
        for (const split of splits) {
          const linkedIds = (split as any).projectTransactionIds || [];
          if (projectTxId && linkedIds.includes(projectTxId)) {
            const newIds = linkedIds.filter((id: string) => id !== projectTxId);
            await FinanceService.updateTransactionSplit(split.id, {
              projectTransactionIds: newIds,
              projectTransactionId: newIds[0] || null,
            } as any);
            await this.removeProjectTxMatchEntry(projectTxId, split.id, bankTransactions, projectTransactions);
          } else if (!projectTxId) {
            await FinanceService.updateTransactionSplit(split.id, {
              projectTransactionIds: [],
              projectTransactionId: null,
            } as any);
            for (const pId of linkedIds) {
              await this.removeProjectTxMatchEntry(pId, split.id, bankTransactions, projectTransactions);
            }
          }
        }
        // Full unlink (no specific projectTxId) — restore parent tx status so it re-enters the reconciliation candidate pool
        if (!projectTxId) {
          await FinanceService.updateTransaction(bankTxId, {
            status: (bankTx as any).prevStatus ?? 'Cleared',
            projectTransactionIds: [],
            projectTransactionId: null,
          });
        }
      }
    } else {
      // Non-split bank tx — simple clear
      const linkedIds = (bankTx as any).projectTransactionIds || [];
      const updates: any = {
        projectTransactionIds: [],
        projectTransactionId: null,
        status: (bankTx as any).prevStatus ?? 'Cleared',
        purpose: '',
      };

      if (isSplitChild) {
        await FinanceService.updateTransactionSplit(bankTxId, updates);
      } else {
        await FinanceService.updateTransaction(bankTxId, updates);
      }

      for (const pId of linkedIds) {
        await this.removeProjectTxMatchEntry(pId, bankTxId, bankTransactions, projectTransactions);
      }
    }
  }

  /**
   * Update reverse index on a project transaction after a match.
   */
  private static async updateProjectTxMatchStatus(
    projectTxId: string,
    bankTxId: string,
    allocatedAmount: number,
    bankTransactions: Transaction[],
    projectTransactions: Transaction[]
  ): Promise<void> {
    const pTx = projectTransactions.find(p => p.id === projectTxId);
    if (!pTx) return;

    const currentMatchedIds = pTx.matchedBankTxIds || [];
    const currentMatchedAmount = pTx.matchedBankAmount || 0;

    const newMatchedIds = currentMatchedIds.includes(bankTxId)
      ? currentMatchedIds
      : [...currentMatchedIds, bankTxId];
    const newMatchedAmount = currentMatchedAmount + allocatedAmount;
    const total = Math.abs(pTx.amount);
    const status = computeMatchStatus(total - newMatchedAmount, total);

    const bankTx = bankTransactions.find(b => b.id === bankTxId);
    const bankDate = bankTx?.date || '';

    const updates: any = {
      matchedBankAmount: newMatchedAmount,
      matchedBankTxIds: newMatchedIds,
      matchStatus: status,
    };

    if (bankDate) {
      updates.date = bankDate;
    }

    // E3: let the error propagate — the caller (executeAutoMatch) catches it per-allocation
    // and records it in summary.errors so the caller knows which updates failed.
    await FinanceService.updateProjectTransaction(projectTxId, updates);
  }

  /**
   * Remove a bank tx entry from a project tx's reverse index.
   */
  private static async removeProjectTxMatchEntry(
    projectTxId: string,
    bankTxId: string,
    bankTransactions: Transaction[],
    projectTransactions: Transaction[]
  ): Promise<void> {
    const pTx = projectTransactions.find(p => p.id === projectTxId);
    if (!pTx) return;

    const currentMatchedIds = (pTx.matchedBankTxIds || []).filter(id => id !== bankTxId);

    // Recompute matched amount from remaining linked bank txs
    let recomputedAmount = 0;
    for (const bId of currentMatchedIds) {
      const btx = bankTransactions.find(b => b.id === bId);
      if (btx) {
        const linked = (btx as any).projectTransactionIds || [];
        if (linked.includes(projectTxId)) {
          recomputedAmount += Math.abs(btx.amount);
        }
      }
    }

    const total = Math.abs(pTx.amount);
    const status = computeMatchStatus(total - recomputedAmount, total);

    const updates: any = {
      matchedBankAmount: recomputedAmount,
      matchedBankTxIds: currentMatchedIds,
      matchStatus: status,
    };

    if (currentMatchedIds.length === 0) {
      updates.date = ''; // Reset to empty string if no matched bank transactions remain
    } else {
      const remainingTx = bankTransactions.find(b => b.id === currentMatchedIds[0]);
      if (remainingTx?.date) {
        updates.date = remainingTx.date;
      }
    }

    try {
      await FinanceService.updateProjectTransaction(projectTxId, updates);
    } catch {
      // Silently skip
    }
  }
}

// FILE: api/boardroom/lib/prompt-builder/media-context.ts
// Layer 10: Media Intelligence Injection
//
// When the CEO attaches a document, URL, or image to a board message,
// each member receives the content filtered through their domain lens.
//
// This is not "Oracle read a document." This is:
//   CFO reads a business listing → extracts cash flow metrics
//   Legal reads the same listing → extracts liability exposure
//   CSO reads the same listing → extracts competitive positioning
//
// The same intelligence, 15 different domain-filtered perspectives.
// This is how a real board operates.
//
// Attachment types:
//   document → PDF, DOCX, TXT extracted client-side, text passed here
//   url      → Perplexity-browsed content from api/boardroom/ingest.ts
//   image    → Oracle see.ts vision result passed as description
//
// Mobile-first: all extraction happens client-side or in ingest.ts.
// This file only formats the already-extracted content for the prompt.

import type { BoardMember } from '../../../../src/lib/boardroom/evolution.js';

// =============================================================================
// TYPES
// =============================================================================

export interface MediaAttachment {
  type: 'document' | 'url' | 'image';
  // Document fields
  fileName?: string;
  mimeType?: string;
  wordCount?: number;
  pageCount?: number;
  truncated?: boolean;
  // URL fields
  url?: string;
  domain?: string;
  title?: string;
  domainFiltered?: boolean;
  // Image fields
  imageDescription?: string;
  visionMode?: string;
  // Shared
  content: string;  // Extracted text (document/URL) or vision description (image)
  summary?: string;
  citations?: string[];
}

// =============================================================================
// DOMAIN-SPECIFIC EXTRACTION INSTRUCTIONS
// Tells the board member what to look for in the attached content
// relative to their specific expertise
// =============================================================================

const DOMAIN_EXTRACTION_HINTS: Record<string, string> = {
  CFO: 'Focus on: revenue figures, margins, cash flow, valuations, debt, tax implications, and acquisition multiples. Flag any numbers that don\'t add up.',
  Legal: 'Focus on: legal structure, liability exposure, contracts mentioned, compliance requirements, IP considerations, and dispute risks. Flag red flags immediately.',
  CSO: 'Focus on: market position, competitive dynamics, growth opportunities, strategic fit, and long-term moat. Identify the strategic narrative.',
  CTO: 'Focus on: technology stack, technical debt, automation opportunities, scalability, and integration complexity. Identify what breaks at scale.',
  COO: 'Focus on: operational processes, key person dependencies, supplier concentration, and efficiency opportunities. Identify the operational risks.',
  CHRO: 'Focus on: team composition, key person risk, culture signals, compensation structure, and retention challenges. Who is essential and who is replaceable?',
  CMO: 'Focus on: brand strength, customer acquisition channels, market awareness, pricing power, and growth levers. What\'s the customer story?',
  Research: 'Focus on: data points, trends, patterns, and predictive signals. What does the data say about the future?',
  Psychology: 'Focus on: human dynamics, incentive structures, behavioral patterns, and decision-making psychology present in this content.',
  General: 'Extract the most important insights relevant to your expertise and the CEO\'s question.',
};

function getDomainHint(member: BoardMember): string {
  const title = (member.title || '').toUpperCase();
  const slug = (member.slug || '').toLowerCase();

  if (title.includes('FINANCIAL') || title.includes('CFO') || slug.includes('cfo')) return DOMAIN_EXTRACTION_HINTS.CFO;
  if (title.includes('LEGAL') || title.includes('COUNSEL')) return DOMAIN_EXTRACTION_HINTS.Legal;
  if (title.includes('STRATEGY') || title.includes('CSO')) return DOMAIN_EXTRACTION_HINTS.CSO;
  if (title.includes('TECHNOLOGY') || title.includes('CTO')) return DOMAIN_EXTRACTION_HINTS.CTO;
  if (title.includes('OPERATIONS') || title.includes('COO')) return DOMAIN_EXTRACTION_HINTS.COO;
  if (title.includes('PEOPLE') || title.includes('HR') || title.includes('CHRO')) return DOMAIN_EXTRACTION_HINTS.CHRO;
  if (title.includes('MARKETING') || title.includes('CMO')) return DOMAIN_EXTRACTION_HINTS.CMO;
  if (title.includes('RESEARCH') || title.includes('INTELLIGENCE')) return DOMAIN_EXTRACTION_HINTS.Research;
  if (title.includes('PSYCHOLOGY') || title.includes('BEHAVIORAL')) return DOMAIN_EXTRACTION_HINTS.Psychology;

  return DOMAIN_EXTRACTION_HINTS.General;
}

// =============================================================================
// FORMAT MEDIA ATTACHMENT FOR PROMPT INJECTION
// =============================================================================

export function formatMediaAttachment(
  attachment: MediaAttachment,
  member: BoardMember,
): string {
  const domainHint = getDomainHint(member);
  const lines: string[] = [];

  // ── Header ───────────────────────────────────────────
  if (attachment.type === 'document') {
    lines.push(`## 📄 ATTACHED DOCUMENT: ${attachment.fileName || 'Document'}`);
    if (attachment.pageCount) lines.push(`Pages: ${attachment.pageCount} | Words: ${attachment.wordCount || 'unknown'}`);
    if (attachment.truncated) lines.push(`⚠️ Document was long — first 12,000 characters shown.`);
  } else if (attachment.type === 'url') {
    lines.push(`## 🌐 RESEARCHED URL: ${attachment.title || attachment.domain || attachment.url}`);
    if (attachment.url) lines.push(`Source: ${attachment.url}`);
    if (attachment.domainFiltered) lines.push(`(Pre-filtered through your domain expertise by Perplexity sonar-pro)`);
  } else if (attachment.type === 'image') {
    lines.push(`## 📸 VISUAL ANALYSIS: ${attachment.visionMode || 'Image'}`);
  }

  // ── Domain extraction instruction ────────────────────
  lines.push(`\n**Your extraction focus as ${member.name}:** ${domainHint}`);

  // ── Content ──────────────────────────────────────────
  lines.push('\n─── CONTENT ───');
  lines.push(attachment.content.substring(0, 8000)); // Cap per member
  lines.push('─── END CONTENT ───');

  // ── Summary if available ─────────────────────────────
  if (attachment.summary && attachment.type === 'url') {
    lines.push(`\n**Research Summary:** ${attachment.summary}`);
  }

  // ── Citations ────────────────────────────────────────
  if (attachment.citations && attachment.citations.length > 0) {
    lines.push(`\n**Sources verified:** ${attachment.citations.slice(0, 5).join(', ')}`);
  }

  // ── Instruction ──────────────────────────────────────
  lines.push(`\nAnalyze the above through your ${member.title} expertise. The CEO's question follows.`);

  return lines.join('\n');
}

// =============================================================================
// FORMAT MULTIPLE ATTACHMENTS
// =============================================================================

export function formatMediaAttachments(
  attachments: MediaAttachment[],
  member: BoardMember,
): string {
  if (!attachments || attachments.length === 0) return '';

  if (attachments.length === 1) {
    return formatMediaAttachment(attachments[0], member);
  }

  const formatted = attachments.map((a, i) =>
    `### ATTACHMENT ${i + 1}\n${formatMediaAttachment(a, member)}`
  );

  return `# MEDIA INTELLIGENCE PACKAGE (${attachments.length} items)\n\n${formatted.join('\n\n')}`;
}
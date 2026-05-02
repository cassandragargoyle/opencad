/**
 * T-FIELD-03: Geolocated field issue cards (PlanGrid-style).
 *
 * Implements:
 *   - FieldIssue schema (3D pin, photo, GPS, BCF link)
 *   - Issue proximity grouping for viewport clusters
 *   - Issue filter/sort helpers
 *   - PDF report data assembly
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface GpsCoordinate {
  latitude: number;
  longitude: number;
  /** Altitude in metres above sea level (optional) */
  altitudeM?: number;
  /** Accuracy in metres (optional) */
  accuracyM?: number;
}

export type FieldIssueStatus = 'open' | 'in-progress' | 'resolved' | 'closed' | 'void';
export type FieldIssuePriority = 'low' | 'medium' | 'high' | 'critical';

export interface FieldIssuePhoto {
  id: string;
  dataUri: string;
  capturedAt: number;
  caption?: string;
}

export interface FieldIssue {
  id: string;
  /** Short title for the card header */
  title: string;
  description?: string;
  status: FieldIssueStatus;
  priority: FieldIssuePriority;
  /** 3D model-space location of the pin (model units, usually mm) */
  position3D: Vec3;
  /** GPS coordinates if available (captured on mobile) */
  gps?: GpsCoordinate;
  /** Photos attached to this issue */
  photos: FieldIssuePhoto[];
  /** Optional link to a BCF topic for traceability */
  bcfTopicGuid?: string;
  /** Element ids of affected BIM elements */
  affectedElementIds: string[];
  assignedTo?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  /** IDs of referenced trade disciplines (e.g. 'MEP', 'Structural') */
  disciplines: string[];
  /** Tags for free-form classification */
  tags: string[];
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

/**
 * Create a new FieldIssue with defaults.
 */
export function createFieldIssue(
  params: Pick<FieldIssue, 'title' | 'position3D' | 'createdBy'> & Partial<FieldIssue>,
): FieldIssue {
  const now = Date.now();
  return {
    id: params.id ?? crypto.randomUUID(),
    title: params.title,
    description: params.description,
    status: params.status ?? 'open',
    priority: params.priority ?? 'medium',
    position3D: params.position3D,
    gps: params.gps,
    photos: params.photos ?? [],
    bcfTopicGuid: params.bcfTopicGuid,
    affectedElementIds: params.affectedElementIds ?? [],
    assignedTo: params.assignedTo,
    createdBy: params.createdBy,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    disciplines: params.disciplines ?? [],
    tags: params.tags ?? [],
  };
}

// ── Filter helpers ────────────────────────────────────────────────────────────

export type IssueFilter = {
  status?: FieldIssueStatus[];
  priority?: FieldIssuePriority[];
  assignedTo?: string;
  createdBy?: string;
  hasBcfLink?: boolean;
  hasPhoto?: boolean;
  tags?: string[];
};

/**
 * Filter a list of field issues by the given criteria.
 * All specified filters must match (AND logic).
 */
export function filterIssues(issues: FieldIssue[], filter: IssueFilter): FieldIssue[] {
  return issues.filter((issue) => {
    if (filter.status   && !filter.status.includes(issue.status))     return false;
    if (filter.priority && !filter.priority.includes(issue.priority)) return false;
    if (filter.assignedTo !== undefined && issue.assignedTo !== filter.assignedTo) return false;
    if (filter.createdBy  !== undefined && issue.createdBy  !== filter.createdBy)  return false;
    if (filter.hasBcfLink === true  && !issue.bcfTopicGuid) return false;
    if (filter.hasBcfLink === false && !!issue.bcfTopicGuid) return false;
    if (filter.hasPhoto   === true  && issue.photos.length === 0) return false;
    if (filter.hasPhoto   === false && issue.photos.length > 0)   return false;
    if (filter.tags && filter.tags.length > 0) {
      const issueTagSet = new Set(issue.tags);
      if (!filter.tags.every((t) => issueTagSet.has(t))) return false;
    }
    return true;
  });
}

export type IssueSortKey = 'createdAt' | 'updatedAt' | 'priority' | 'status' | 'title';

const PRIORITY_ORDER: Record<FieldIssuePriority, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

const STATUS_ORDER: Record<FieldIssueStatus, number> = {
  open: 0, 'in-progress': 1, resolved: 2, closed: 3, void: 4,
};

/**
 * Sort issues by the given key (ascending).
 * Returns a new array; original is not mutated.
 */
export function sortIssues(issues: FieldIssue[], key: IssueSortKey, desc = false): FieldIssue[] {
  const sorted = [...issues].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case 'createdAt':  cmp = a.createdAt  - b.createdAt;  break;
      case 'updatedAt':  cmp = a.updatedAt  - b.updatedAt;  break;
      case 'priority':   cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]; break;
      case 'status':     cmp = STATUS_ORDER[a.status]     - STATUS_ORDER[b.status];     break;
      case 'title':      cmp = a.title.localeCompare(b.title); break;
    }
    return desc ? -cmp : cmp;
  });
  return sorted;
}

// ── Proximity clustering ──────────────────────────────────────────────────────

export interface IssueCluster {
  centroid: Vec3;
  issueIds: string[];
  count: number;
}

/**
 * Group nearby issues into clusters for viewport display.
 * Two issues are considered "nearby" if their 3D distance is within `radiusMm`.
 *
 * Uses greedy O(n²) clustering — sufficient for typical field issue counts (<1000).
 */
export function clusterIssues(issues: FieldIssue[], radiusMm: number): IssueCluster[] {
  const clusters: IssueCluster[] = [];
  const assigned = new Set<string>();

  for (const issue of issues) {
    if (assigned.has(issue.id)) continue;

    const nearby = issues.filter(
      (other) => !assigned.has(other.id) && dist3D(issue.position3D, other.position3D) <= radiusMm,
    );

    const centroid = avgVec3(nearby.map((i) => i.position3D));
    const ids = nearby.map((i) => i.id);
    ids.forEach((id) => assigned.add(id));

    clusters.push({ centroid, issueIds: ids, count: ids.length });
  }

  return clusters;
}

function dist3D(a: Vec3, b: Vec3): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + (b.z - a.z) ** 2);
}

function avgVec3(pts: Vec3[]): Vec3 {
  if (pts.length === 0) return { x: 0, y: 0, z: 0 };
  const sum = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y, z: acc.z + p.z }), { x: 0, y: 0, z: 0 });
  return { x: sum.x / pts.length, y: sum.y / pts.length, z: sum.z / pts.length };
}

/** Euclidean 3D distance between two issue positions in mm. */
export function issueDistance(a: FieldIssue, b: FieldIssue): number {
  return dist3D(a.position3D, b.position3D);
}

// ── Summary stats ─────────────────────────────────────────────────────────────

export interface IssueStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  critical: number;
  withPhotos: number;
  withBcf: number;
}

/**
 * Compute summary statistics for a list of issues.
 */
export function issueStats(issues: FieldIssue[]): IssueStats {
  return {
    total:      issues.length,
    open:       issues.filter((i) => i.status === 'open').length,
    inProgress: issues.filter((i) => i.status === 'in-progress').length,
    resolved:   issues.filter((i) => i.status === 'resolved').length,
    closed:     issues.filter((i) => i.status === 'closed').length,
    critical:   issues.filter((i) => i.priority === 'critical').length,
    withPhotos: issues.filter((i) => i.photos.length > 0).length,
    withBcf:    issues.filter((i) => !!i.bcfTopicGuid).length,
  };
}

// ── PDF report assembly ───────────────────────────────────────────────────────

export interface IssueReportEntry {
  issueNumber: number;
  title: string;
  status: string;
  priority: string;
  description?: string;
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  photoCount: number;
  gpsLabel?: string;
  bcfTopicGuid?: string;
}

/**
 * Assemble report entries for PDF generation.
 * Issues are sorted by priority then creation date.
 */
export function assembleReportEntries(issues: FieldIssue[]): IssueReportEntry[] {
  const sorted = sortIssues(sortIssues(issues, 'createdAt'), 'priority');
  return sorted.map((issue, i) => ({
    issueNumber: i + 1,
    title:       issue.title,
    status:      issue.status,
    priority:    issue.priority,
    description: issue.description,
    assignedTo:  issue.assignedTo,
    createdBy:   issue.createdBy,
    createdAt:   new Date(issue.createdAt).toISOString().split('T')[0]!,
    photoCount:  issue.photos.length,
    gpsLabel:    issue.gps
      ? `${issue.gps.latitude.toFixed(6)}, ${issue.gps.longitude.toFixed(6)}`
      : undefined,
    bcfTopicGuid: issue.bcfTopicGuid,
  }));
}

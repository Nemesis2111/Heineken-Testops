import { Building2, KeyRound, Package, Handshake, FileText, Gift, BarChart3 } from "lucide-react";
import type { Project, TestCase, Defect, TestStatus } from "../types";

export const PROJECTS: Project[] = [
  { id: "ironclad", name: "IronClad", icon: Building2, health: 87, execution: 78, defects: 23, risks: "Medium", uat: "In Progress", deployment: "On Track" },
  { id: "heikey", name: "HeiKey", icon: KeyRound, health: 92, execution: 88, defects: 9, risks: "Low", uat: "Completed", deployment: "Ready" },
  { id: "srm", name: "SRM", icon: Package, health: 74, execution: 63, defects: 31, risks: "High", uat: "In Progress", deployment: "At Risk" },
  { id: "zycus-isupplier", name: "Zycus iSupplier", icon: Handshake, health: 81, execution: 71, defects: 17, risks: "Medium", uat: "In Progress", deployment: "On Track" },
  { id: "zycus-icontract", name: "Zycus iContract", icon: FileText, health: 90, execution: 85, defects: 8, risks: "Low", uat: "Completed", deployment: "Ready" },
  { id: "posm", name: "POSM", icon: Gift, health: 68, execution: 55, defects: 26, risks: "High", uat: "Not Started", deployment: "At Risk" },
  { id: "ocp", name: "OCP", icon: BarChart3, health: 83, execution: 76, defects: 14, risks: "Medium", uat: "In Progress", deployment: "On Track" },
];

export const PHASES = ["UT", "SIT", "UAT", "Dry Run", "Dress Rehearsal"];
export const STATUSES: TestStatus[] = ["Passed", "Failed", "Blocked", "In Progress", "Not Run"];
export const NAMES = ["Amit Pratihar", "Sanjana S", "Nikin Kannolli", "Haresh Dharssan", "Aniket Chatterjee", "Pooja Chundru", "Vyshnavi Thota", "Pavan Kulkarni", "Shaunak Chandra", "Gunturu Kusuma"];
export const COUNTRIES = ["UK", "Nigeria", "Poland", "India", "Netherlands", "Vietnam", "Mexico"];

export function seededRand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function generateTestCases(): TestCase[] {
  const rows: TestCase[] = [];
  let n = 0;
  PROJECTS.forEach((proj, pi) => {
    PHASES.forEach((phase, phi) => {
      const count = 4 + Math.floor(seededRand(pi * 13 + phi) * 4);
      for (let i = 0; i < count; i++) {
        n++;
        const r = seededRand(n * 7.31);
        const status = STATUSES[Math.floor(r * STATUSES.length)];
        const hasDefect = status === "Failed" || (status === "Blocked" && r > 0.5);
        const country = COUNTRIES[Math.floor(seededRand(n * 3.1) * COUNTRIES.length)];
        rows.push({
          id: `TR-${700 + n}`,
          directory: `Wave 1 Release / ${phase} / ${country} / ${country}`,
          name: `${phase}_${i + 1} : ${proj.name}-Proc-${["Indirects", "Contracts", "Goods Agreement", "Vendor Onboarding", "Invoice Match"][n % 5]}`,
          status,
          project: proj.name,
          phase,
          assignedTo: NAMES[n % NAMES.length],
          execStart: status === "Not Run" ? "-" : `2${n % 8}/06/2026 0${1 + (n % 8)}:${10 + (n % 4) * 5} PM`,
          execEnd: status === "Not Run" ? "-" : `2${n % 8}/06/2026 0${1 + (n % 8)}:${25 + (n % 4) * 5} PM`,
          planStart: "24/06/2026",
          planEnd: "26/06/2026",
          defects: hasDefect ? 1 + (n % 2) : 0,
          defectIds: hasDefect ? `DPD0-${3370 + (n % 40)}` : "-",
          requirements: `REQ-${1000 + (n % 60)}`,
          role: ["Buyer", "Approver", "Admin", "Supplier"][n % 4],
          stepRole: ["Procurement Lead", "Legal Approver", "System", "Finance"][n % 4],
          actualResult: status === "Passed" ? "As expected" : status === "Not Run" ? "-" : "Deviation observed",
          stepStatus: status,
        });
      }
    });
  });
  return rows;
}

export const PRIORITIES = ["Blocker (P1)", "Critical (P2)", "Major (P3)", "Minor (P4)"];
export const D_STATUSES = ["To Do", "In Progress", "Ready for review", "Done"];
export const ASSIGNEES = ["Sanjana S", "Nikin Kannolli", "Priya Nair", "Marta Kowalski", "Dev Kapoor"];
export const SPRINTS = ["Sprint#4 [EXT]", "Sprint#5 [EXT]", "Sprint#6 [EXT]", "Sprint#7 [EXT]"];

export function generateDefects(): Defect[] {
  const rows: Defect[] = [];
  let n = 0;
  PROJECTS.forEach((proj, pi) => {
    const count = 3 + Math.floor(seededRand(pi * 5.5) * 5);
    for (let i = 0; i < count; i++) {
      n++;
      const r = seededRand(n * 9.11);
      rows.push({
        key: `DPD0-${3370 + n}`,
        title: `${proj.name} | ${["Gap in expiry validation", "Approver missing edit rights", "Invoice mismatch on tax code", "Vendor sync delay", "Workflow stuck on review"][n % 5]}`,
        team: "DT Procurement Deployments",
        assignee: ASSIGNEES[n % ASSIGNEES.length],
        reporter: ASSIGNEES[(n + 2) % ASSIGNEES.length],
        sprint: `${proj.name}_Deployments_${SPRINTS[n % SPRINTS.length]}`,
        priority: PRIORITIES[Math.floor(r * PRIORITIES.length)],
        status: D_STATUSES[Math.floor(seededRand(n * 4.2) * D_STATUSES.length)],
        project: proj.name,
        labels: `${proj.name}_Deployment, ${["SIT", "UAT", "Regression"][n % 3]}`,
        components: `Deployment_${proj.name}, DP_${COUNTRIES[n % COUNTRIES.length]}`,
        created:   `0${1 + (n % 9)}/07/2025`,
        targetEnd: `${10 + (n % 18)}-Jun-26`,
        progress: Math.floor(seededRand(n * 2.7) * 100),
        estimate: 1 + (n % 5),
      });
    }
  });
  return rows;
}

export const EXECUTION_TREND = Array.from({ length: 14 }).map((_, i) => {
  const base = 40 + i * 4;
  return {
    day: `Jun ${11 + i}`,
    executed: Math.round(base + seededRand(i * 1.7) * 15),
    passed: Math.round(base * 0.78 + seededRand(i * 2.3) * 10),
    failed: Math.round(6 + seededRand(i * 3.9) * 6),
  };
});

export const PASS_RATE_TREND = EXECUTION_TREND.map((d) => ({ day: d.day, passRate: Math.min(99, Math.round((d.passed / d.executed) * 100)) }));

export const VELOCITY_DATA = Array.from({ length: 10 }).map((_, i) => ({
  day: `D${i + 1}`,
  planned: 30 + i * 2,
  actual: 26 + Math.round(seededRand(i * 5.5) * 10),
}));

export const HEATMAP_WEEKS = 6;
export const HEATMAP = Array.from({ length: HEATMAP_WEEKS }).map((_, w) =>
  Array.from({ length: 7 }).map((_, d) => Math.floor(seededRand(w * 7 + d + 1) * 100))
);

export const AI_QA = [
  { q: "How many defects are open?", a: () => `There are ${generateDefects().filter((d) => d.status !== "Done").length} open defects across all seven projects, with IronClad and SRM contributing the most.` },
  { q: "Show today's execution summary.", a: () => "Today: 187 cases executed, 146 passed (78%), 21 failed, 20 blocked. HeiKey is fully on schedule; POSM is lagging." },
  { q: "Which sprint has maximum issues?", a: () => "SRM_Deployments_Sprint#6 [EXT] currently has the most open issues, mostly Major (P3) priority." },
  { q: "Generate executive update.", a: () => "Overall program health is Stable (82/100). Execution is 76% complete with a 79% pass rate. IronClad and SRM need defect burn-down focus before UAT sign-off; HeiKey and Zycus iContract are deployment-ready." },
];

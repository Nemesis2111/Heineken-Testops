import type { LucideIcon } from "lucide-react";

export interface Project {
  id: string;
  name: string;
  icon: LucideIcon;
  health: number;
  execution: number;
  defects: number;
  risks: "Low" | "Medium" | "High";
  uat: string;
  deployment: "Ready" | "On Track" | "At Risk";
}

export type TestStatus = "Passed" | "Failed" | "Blocked" | "In Progress" | "Not Run";

export interface TestCase {
  id: string;
  directory: string;
  name: string;
  status: TestStatus;
  project: string;
  phase: string;
  assignedTo: string;
  execStart: string;
  execEnd: string;
  planStart: string;
  planEnd: string;
  defects: number;
  defectIds: string;
  requirements: string;
  testCaseVersion?: string;
  testStepNum?: string;
  testStepDescription?: string;
  testStep?: string;
  role: string;
  stepRole: string;
  actualResult: string;
  stepStatus: TestStatus;
}

export interface Defect {
  key: string;
  title: string;
  team: string;
  assignee: string;
  reporter: string;
  sprint: string;
  priority: string;
  status: string;
  project: string;
  labels: string;
  components: string;
  created: string;
  targetEnd: string;
  progress: number;
  estimate: number;
}

/**
 * useXlsxWorker.ts
 * ─────────────────────────────────────────────────────────────
 * React hook that spawns the xlsx Web Worker and provides a
 * clean Promise-based API.
 *
 * The worker is created lazily on first use and reused for
 * subsequent calls (one instance per hook invocation).
 */
import { useRef, useCallback } from "react";
import type { MerlinWorkbook } from "./merlinTypes";
import type { SheetRows } from "./parseXlsxMultiSheet";

type ProgressCb = (pct: number) => void;

// Re-export for type-checking
export type { MerlinWorkbook, SheetRows };

export function useXlsxWorker() {
  const workerRef = useRef<Worker | null>(null);

  function getWorker(): Worker {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("./xlsxWorker.ts", import.meta.url),
        { type: "module" }
      );
    }
    return workerRef.current;
  }

  /** Parse the Merlin workbook — returns a MerlinWorkbook or rejects with error */
  const parseMerlin = useCallback(
    (file: File, onProgress?: ProgressCb): Promise<MerlinWorkbook> => {
      return new Promise((resolve, reject) => {
        // Terminate any stale worker and create a fresh one for each Merlin parse
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        const worker = getWorker();

        // 60-second hard timeout — terminates and rejects if worker stalls
        const hardTimeout = setTimeout(() => {
          worker.removeEventListener("message", handler);
          worker.terminate();
          workerRef.current = null;
          reject(new Error("Parse timed out after 60 s. The file may be too large or corrupt."));
        }, 60_000);

        const handler = (e: MessageEvent) => {
          const { type, pct, result, message, missing, present, sheetNames } = e.data;
          if (type === "PROGRESS") {
            onProgress?.(pct);
          } else if (type === "MERLIN_DONE") {
            clearTimeout(hardTimeout);
            worker.removeEventListener("message", handler);
            resolve({ ...result, fileName: file.name });
          } else if (type === "VALIDATION_ERROR") {
            // Build a human-readable error with sheet-level detail
            clearTimeout(hardTimeout);
            worker.removeEventListener("message", handler);
            const checklist = (present as { name: string; found: boolean }[])
              .map((s) => `${s.found ? "✓" : "✗"} ${s.name}`)
              .join("\n");
            const foundNames = (sheetNames as string[]).join(", ") || "none";
            reject(new Error(
              `Invalid Merlin Intake V5 workbook.\n\nRequired sheets:\n${checklist}\n\nMissing: ${(missing as string[]).join(", ")}\nFound in file: ${foundNames}`
            ));
          } else if (type === "ERROR") {
            clearTimeout(hardTimeout);
            worker.removeEventListener("message", handler);
            reject(new Error(message));
          }
        };

        worker.addEventListener("message", handler);

        file.arrayBuffer().then((ab) => {
          worker.postMessage({ type: "PARSE_MERLIN", buffer: ab, fileName: file.name }, [ab]);
        }).catch((e) => { clearTimeout(hardTimeout); reject(e); });
      });
    },
    []
  );

  /** Parse the first sheet of any xlsx/xls file — returns header-keyed rows */
  const parseSingleSheet = useCallback(
    (file: File, onProgress?: ProgressCb): Promise<SheetRows> => {
      return new Promise((resolve, reject) => {
        const worker = getWorker();

        const handler = (e: MessageEvent) => {
          const { type, pct, result, message } = e.data;
          if (type === "PROGRESS") {
            onProgress?.(pct);
          } else if (type === "SHEET_DONE") {
            worker.removeEventListener("message", handler);
            resolve(result);
          } else if (type === "ERROR") {
            worker.removeEventListener("message", handler);
            reject(new Error(message));
          }
        };

        worker.addEventListener("message", handler);

        file.arrayBuffer().then((ab) => {
          worker.postMessage({ type: "PARSE_SINGLE_SHEET", buffer: ab }, [ab]);
        }).catch(reject);
      });
    },
    []
  );

  return { parseMerlin, parseSingleSheet };
}

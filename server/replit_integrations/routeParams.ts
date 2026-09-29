import type { Response } from "express";

export function parsePositiveIntegerRouteParam(
  rawParam: string | string[],
  res: Response,
  paramName: string,
): number | undefined {
  const value = Array.isArray(rawParam) ? rawParam[0] : rawParam;
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : NaN;

  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    res.status(400).json({ error: `Invalid ${paramName}` });
    return undefined;
  }

  return parsed;
}
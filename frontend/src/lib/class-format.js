export function formatGrade(grade) {
  return String(grade ?? "").replace(/^class\s+/i, "").trim();
}

export function formatClassName(cls) {
  if (!cls) return "";
  return [formatGrade(cls.grade), cls.section].filter(Boolean).join("-");
}

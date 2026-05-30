export function normalizeAttendanceSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function filterAttendanceStudents<T extends { full_name: string }>(
  students: T[],
  query: string,
) {
  const normalizedQuery = normalizeAttendanceSearchText(query);

  if (!normalizedQuery) {
    return students;
  }

  return students.filter((student) =>
    normalizeAttendanceSearchText(student.full_name).includes(normalizedQuery),
  );
}

export function formatAttendanceStudentName(fullName: string) {
  const parts = fullName.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const firstName = (parts[0] || "Aluno").toLocaleUpperCase("pt-BR");
  const surname = (parts.length > 1 ? parts[parts.length - 1] : "").toLocaleUpperCase("pt-BR");
  const compactName = [firstName, surname].filter(Boolean).join(" ");

  return {
    firstName,
    surname,
    compactName,
  };
}

export function applySavedAttendanceStudent<T extends { student: { id: string } }>(
  pendingStudents: T[],
  savedStudents: T[],
  updatedStudent: T,
) {
  return {
    pendingStudents: pendingStudents.filter((item) => item.student.id !== updatedStudent.student.id),
    savedStudents: [
      updatedStudent,
      ...savedStudents.filter((item) => item.student.id !== updatedStudent.student.id),
    ],
  };
}

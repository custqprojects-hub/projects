import { useEffect, useMemo, useState } from "react";
import { useListExamResults, useListExams, useListStudents, useListSubjects, useListClasses, useCreateExamResult, useUpdateExamResult, getListExamResultsQueryKey, getListExamsQueryKey, getListStudentsQueryKey, getListSubjectsQueryKey, getListClassesQueryKey, UserRole } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trophy, Grid3X3, BarChart2, CheckCircle, BookOpen, AlertTriangle, Edit, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const gradeColors = {
  "A+": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "A": "bg-green-500/10 text-green-400 border-green-500/20",
  "B+": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "B": "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "C": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  "D": "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "F": "bg-red-500/10 text-red-400 border-red-500/20",
};

const defaultForm = {
  examId: "",
  studentId: "",
  subjectId: "",
  marksObtained: "",
  maxMarks: "100",
};

// Pagination configuration
const ITEMS_PER_PAGE = 7;

export default function ExamResults() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [gridOpen, setGridOpen] = useState(false);
  const [filterExam, setFilterExam] = useState("all");
  const [form, setForm] = useState(defaultForm);
  const [gridExamId, setGridExamId] = useState("");
  const [gridClassId, setGridClassId] = useState("");
  const [gridMarks, setGridMarks] = useState({});

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);

  // Supplementary states
  const [showFailuresOnly, setShowFailuresOnly] = useState(false);
  const [suppOpen, setSuppOpen] = useState(null);
  const [suppMarks, setSuppMarks] = useState("");
  const [suppRemarks, setSuppRemarks] = useState("");
  const [savingSupp, setSavingSupp] = useState(false);
  const [downloadingTranscript, setDownloadingTranscript] = useState(false);

  // Edit states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState(null);
  const [editForm, setEditForm] = useState({
    marksObtained: "",
    remarks: "",
  });

  const params = filterExam && filterExam !== "all" ? { examId: filterExam } : {};

  const { data: results = [], isLoading } = useListExamResults(params, {
    query: { queryKey: getListExamResultsQueryKey(params), staleTime: 10000 }
  });
  const { data: allExamResults = [] } = useListExamResults({}, {
    query: { queryKey: getListExamResultsQueryKey(), staleTime: 10000 }
  });

  const { data: exams = [] } = useListExams({ 
    query: { queryKey: getListExamsQueryKey(), staleTime: 30000 } 
  });
  
  const { data: allStudents = [] } = useListStudents({}, { 
    query: { queryKey: getListStudentsQueryKey(), staleTime: 30000, enabled: user?.role === "admin" || user?.role === "teacher" } 
  });

  const { data: subjects = [] } = useListSubjects({ query: { queryKey: getListSubjectsQueryKey(), staleTime: 30000 } });
  const { data: classes = [] } = useListClasses({ query: { queryKey: getListClassesQueryKey(), staleTime: 30000 } });

  const teacherClassIds = useMemo(
    () => new Set(classes.map((c) => Number(c.id))),
    [classes]
  );

  const assignedStudentClassIds = useMemo(
    () => new Set(allStudents.map((student) => Number(student.classId)).filter(Boolean)),
    [allStudents]
  );

  const teacherAccessibleClassIds = useMemo(() => {
    if (user?.role !== "teacher") return null;
    const ids = new Set(assignedStudentClassIds);
    for (const classId of teacherClassIds) ids.add(classId);
    return ids;
  }, [assignedStudentClassIds, teacherClassIds, user?.role]);

  const completedExams = useMemo(() => {
    return exams.filter((exam) => {
      if (!exam?.id) return false;
      if (teacherAccessibleClassIds && !teacherAccessibleClassIds.has(Number(exam.classId))) {
        return false;
      }
      return exam.status?.toString().toLowerCase() === "completed";
    });
  }, [exams, teacherAccessibleClassIds]);

  const assignedResultExams = useMemo(() => {
    const assigned = exams.filter((exam) => {
      if (!exam?.id) return false;
      if (teacherAccessibleClassIds && !teacherAccessibleClassIds.has(Number(exam.classId))) {
        return false;
      }
      return true;
    });

    return assigned.sort((a, b) =>
      String(a.name || `Exam ${a.id}`).localeCompare(String(b.name || `Exam ${b.id}`))
    );
  }, [exams, teacherAccessibleClassIds]);

  useEffect(() => {
    if (filterExam === "all") return;
    const isAssigned = assignedResultExams.some((exam) => String(exam.id) === String(filterExam));
    if (!isAssigned) setFilterExam("all");
  }, [assignedResultExams, filterExam]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterExam, showFailuresOnly]);

  const createMutation = useCreateExamResult({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListExamResultsQueryKey() });
        toast({ title: "Success", description: "Exam result saved successfully!" });
      },
      onError: () => toast({ title: "Error", description: "Failed to save result.", variant: "destructive" }),
    }
  });

  const updateMutation = useUpdateExamResult({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListExamResultsQueryKey() });
        toast({ title: "Success", description: "Result updated successfully!" });
        setEditDialogOpen(false);
        setEditingResult(null);
      },
      onError: () => toast({ title: "Error", description: "Failed to update result.", variant: "destructive" }),
    }
  });

  const isTeacher = user?.role === "teacher";
  const isAdmin = user?.role === "admin";
  const isStudent = user?.role === UserRole.student;

  // === FIXED: Active Exams Count ===
  const activeExamsCount = exams.filter(e => {
    if (!e) return false;
    const status = (e.status || "").toString().toLowerCase().trim();
    return (
      status === "published" ||
      status === "active" ||
      status === "ongoing" ||
      e.isActive === true ||
      e.isPublished === true ||
      e.published === true
    );
  }).length;

  const isDuplicate = (examId, studentId, subjectId) => {
    return allExamResults.some(r =>
      r.examId === Number(examId) &&
      r.studentId === Number(studentId) &&
      r.subjectId === Number(subjectId)
    );
  };

  const scopedResults = results;

  const avgScore = scopedResults.length > 0
    ? Math.round(scopedResults.reduce((a, r) => a + (Number(r.marksObtained) / Number(r.maxMarks)) * 100, 0) / scopedResults.length)
    : 0;

  const passRate = scopedResults.length > 0
    ? Math.round((scopedResults.filter((r) => r.grade !== "F").length / scopedResults.length) * 100)
    : 0;

  // Get students who are enrolled in the selected exam's class
  const getStudentsForExam = () => {
    if (!gridExamId) return [];
    
    // Find the selected exam
    const selectedExam = exams.find(e => String(e.id) === gridExamId);
    if (!selectedExam) return [];
    
    // Get students for the exam's class
    return allStudents.filter(s => String(s.classId) === String(selectedExam.classId));
  };

  // Get subjects for the selected exam's class
  const getSubjectsForExam = () => {
    if (!gridExamId) return [];
    
    const selectedExam = exams.find(e => String(e.id) === gridExamId);
    if (!selectedExam) return [];
    
    return subjects.filter(s => String(s.classId) === String(selectedExam.classId));
  };

  // Get students for dropdown in single entry
  const getSelectedFormExam = () => exams.find(e => String(e.id) === form.examId);

  const isFailedOriginalResult = (result, originalExam) => {
    const passingMarks = Number(originalExam?.passingMarks ?? 0);
    return result.grade === "F" || (passingMarks > 0 && Number(result.marksObtained) < passingMarks);
  };

  const getSupplyFailureResults = (exam) => {
    if (!exam?.isSupply || !exam?.originalExamId) return [];
    const originalExam = exams.find(e => Number(e.id) === Number(exam.originalExamId));
    return allExamResults.filter(r =>
      Number(r.examId) === Number(exam.originalExamId) &&
      isFailedOriginalResult(r, originalExam)
    );
  };

  const getStudentsForExamDropdown = () => {
    if (!form.examId) return allStudents;
    
    const selectedExam = getSelectedFormExam();
    if (!selectedExam) return allStudents;

    const classStudents = allStudents.filter(s => String(s.classId) === String(selectedExam.classId));
    if (!selectedExam.isSupply) return classStudents;

    const failedStudentIds = new Set(getSupplyFailureResults(selectedExam).map(r => Number(r.studentId)));
    return classStudents.filter(s => failedStudentIds.has(Number(s.id)));
  };

  // Get subjects for dropdown in single entry
  const getSubjectsForExamDropdown = () => {
    if (!form.examId) return subjects;
    
    const selectedExam = getSelectedFormExam();
    if (!selectedExam) return subjects;

    const classSubjects = subjects.filter(s => String(s.classId) === String(selectedExam.classId));
    if (!selectedExam.isSupply || !form.studentId) return classSubjects;

    const failedSubjectIds = new Set(getSupplyFailureResults(selectedExam)
      .filter(r => Number(r.studentId) === Number(form.studentId))
      .map(r => Number(r.subjectId)));
    return classSubjects.filter(s => failedSubjectIds.has(Number(s.id)));
  };

  const gridStudents = getStudentsForExam();
  const gridSubjects = getSubjectsForExam();

  const totalGridEntries = Object.values(gridMarks).reduce((acc, subjectMap) =>
    acc + Object.values(subjectMap).filter(v => v.trim() !== "").length, 0);

  const handleGridSubmit = async () => {
    let savedCount = 0;
    let duplicateCount = 0;

    for (const [studentIdStr, subjectMap] of Object.entries(gridMarks)) {
      for (const [subjectIdStr, marks] of Object.entries(subjectMap)) {
        if (!marks.trim()) continue;

        const examId = parseInt(gridExamId);
        const studentId = parseInt(studentIdStr);
        const subjectId = parseInt(subjectIdStr);

        if (isDuplicate(examId, studentId, subjectId)) {
          duplicateCount++;
          continue;
        }

        await createMutation.mutateAsync({
          data: {
            examId,
            studentId,
            subjectId,
            marksObtained: parseFloat(marks),
            maxMarks: 100,
          },
        });
        savedCount++;
      }
    }

    if (savedCount > 0) toast({ title: "Success", description: `${savedCount} result(s) saved successfully.` });
    if (duplicateCount > 0) toast({ title: "Info", description: `${duplicateCount} duplicate entry(s) skipped.`, variant: "default" });

    setGridMarks({});
    setGridOpen(false);
  };

  const handleSupplementarySubmit = async () => {
    if (!suppOpen || !suppMarks) return;
    setSavingSupp(true);
    try {
      const res = await fetch(`/api/exam-results/${suppOpen.id}/supplementary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marksObtained: parseFloat(suppMarks), remarks: suppRemarks }),
        credentials: "include"
      });

      if (!res.ok) throw new Error("Failed to submit supplementary marks");

      toast({ title: "Success", description: "Supplementary marks updated!" });
      qc.invalidateQueries({ queryKey: getListExamResultsQueryKey() });
      setSuppOpen(null);
      setSuppMarks("");
      setSuppRemarks("");
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingSupp(false);
    }
  };

  const handleDownloadReportCard = async (studentId, studentName, examId = null) => {
    setDownloadingTranscript(true);
    try {
      let resultsForStudent = [];

      // Try API first (if it supports filtering)
      try {
        const url = examId 
          ? `/api/exam-results/student/${studentId}/gpa?examId=${examId}` 
          : `/api/exam-results/student/${studentId}/gpa`;
        
        const res = await fetch(url, { credentials: "include" });
        if (res.ok) {
          const apiData = await res.json();
          resultsForStudent = apiData.results || [];
        }
      } catch (e) {
        console.warn("API fetch failed, using local data");
      }

      // Fallback: Filter from scopedResults (current table data)
      if (resultsForStudent.length === 0) {
        let filtered = scopedResults.filter(r => String(r.studentId) === String(studentId));

        // If specific exam is requested, filter only that exam
        if (examId) {
          filtered = filtered.filter(r => String(r.examId) === String(examId));
        }

        resultsForStudent = filtered.map(r => ({
          examName: r.examName || "Unknown Exam",
          subjectName: r.subjectName || "Unknown Subject",
          marksObtained: Number(r.marksObtained),
          maxMarks: Number(r.maxMarks || 100),
          grade: r.grade
        }));
      }

      // Remove any remaining duplicates
      resultsForStudent = resultsForStudent.filter((item, index, self) =>
        index === self.findIndex((t) => 
          t.examName === item.examName && 
          t.subjectName === item.subjectName && 
          t.marksObtained === item.marksObtained
        )
      );

      // Calculate summary for the selected results
      const totalSubjects = resultsForStudent.length;
      let avgScore = 0;
      let passRate = 0;

      if (totalSubjects > 0) {
        const totalMarks = resultsForStudent.reduce((sum, r) => sum + r.marksObtained, 0);
        avgScore = Math.round(totalMarks / totalSubjects);
        const passed = resultsForStudent.filter(r => r.grade !== "F").length;
        passRate = Math.round((passed / totalSubjects) * 100);
      }

      // ====================== PDF Generation ======================
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 25;

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(16, 185, 129);
      doc.text("NEXUS ACADEMY", pageWidth / 2, y, { align: "center" });
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(100, 116, 139);
      doc.text("OFFICIAL REPORT CARD & ACADEMIC TRANSCRIPT", pageWidth / 2, y, { align: "center" });
      y += 18;

      // Student Info
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");

      doc.text(`Student Name: ${studentName}`, margin, y);
      y += 8;
      doc.text(`Roll Number: N/A`, margin, y);
      y += 8;
      doc.text(`Class: N/A`, margin, y);
      y += 8;
      doc.text(`Academic Year: 2025-26`, margin, y);
      y += 8;
      doc.text(`Date of Issue: ${new Date().toLocaleDateString('en-IN')}`, margin, y);
      y += 12;

      // Exam Title (if specific exam)
      if (examId) {
        const examName = exams.find(e => String(e.id) === String(examId))?.name || "Selected Exam";
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text(`Exam: ${examName}`, margin, y);
        y += 12;
      } else {
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("ACADEMIC PERFORMANCE", margin, y);
        y += 12;
      }

      if (resultsForStudent.length === 0) {
        doc.setFontSize(11);
        doc.text("No results found.", margin, y);
      } else {
        // Table Header
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, pageWidth - margin * 2, 11, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Exam", margin + 5, y + 8);
        doc.text("Subject", margin + 65, y + 8);
        doc.text("Marks", margin + 135, y + 8);
        doc.text("Grade", margin + 175, y + 8);
        y += 14;

        // Table Rows
        doc.setFont("helvetica", "normal");
        resultsForStudent.forEach((r) => {
          if (y > 265) {
            doc.addPage();
            y = 30;
          }

          const marksText = `${r.marksObtained} / ${r.maxMarks}`;

          doc.text(r.examName.substring(0, 30), margin + 5, y);
          doc.text(r.subjectName.substring(0, 35), margin + 65, y);
          doc.text(marksText, margin + 135, y);

          const gradeColor = (r.grade === "A+" || r.grade === "A") ? [16, 185, 129] :
                            (r.grade === "B+" || r.grade === "B") ? [59, 130, 246] :
                            (r.grade === "C") ? [234, 179, 8] : [239, 68, 68];

          doc.setTextColor(...gradeColor);
          doc.text(r.grade, margin + 175, y);
          doc.setTextColor(0, 0, 0);

          y += 11;
        });
      }

      // Summary
      y += 15;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Overall Average Score: ${avgScore}%`, margin, y);
      y += 9;
      doc.text(`Pass Rate: ${passRate}%`, margin, y);
      y += 9;
      doc.text(`Total Subjects: ${totalSubjects}`, margin, y);

      // Footer
      doc.setFontSize(9);
      doc.setTextColor(128);
      doc.text("This is a computer-generated document.", pageWidth / 2, 285, { align: "center" });
      doc.text(`Generated on: ${new Date().toLocaleString('en-IN')}`, pageWidth / 2, 290, { align: "center" });

      const fileName = `Report_Card_${studentName.replace(/\s+/g, "_")}${examId ? "_Specific_Exam" : ""}.pdf`;
      doc.save(fileName);

      toast({ title: "Success", description: "Report Card downloaded successfully!" });
    } catch (err) {
      console.error(err);
      toast({
        title: "Download Failed",
        description: "Could not generate report card.",
        variant: "destructive"
      });
    } finally {
      setDownloadingTranscript(false);
    }
  };

  // Filter and sort results (descending order - newest first based on id or created date)
  const filteredAndSortedResults = useMemo(() => {
    let filtered = scopedResults.filter(r => {
      if (showFailuresOnly) return r.grade === "F" || Number(r.marksObtained) < 35;
      return true;
    });

    // Sort by id in descending order (assuming higher id = newer)
    // You can change this to sort by createdAt or any other field
    return filtered.sort((a, b) => {
      // If there's a createdAt field, use that
      if (a.createdAt && b.createdAt) {
        return new Date(b.createdAt) - new Date(a.createdAt);
      }
      // Fallback to id
      return (b.id || 0) - (a.id || 0);
    });
  }, [scopedResults, showFailuresOnly]);

  // Pagination calculations
  const totalItems = filteredAndSortedResults.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  
  // Ensure current page is within bounds
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  
  // Get current page items
  const currentItems = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, totalItems);
    return filteredAndSortedResults.slice(startIndex, endIndex);
  }, [filteredAndSortedResults, safeCurrentPage]);

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-emerald-400">Exam Results</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isStudent ? "Your personal results" : "View and manage exam result data"}
          </p>
        </div>

        {isTeacher && (
          <div className="flex flex-wrap gap-2">
            {/* Grid Entry Dialog */}
            <Dialog open={gridOpen} onOpenChange={setGridOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Grid3X3 className="w-4 h-4" /> Grid Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl w-[95vw] max-h-[92vh] p-4 overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Grid Result Entry - Whole Class</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label>Exam *</Label>
                      <Select 
                        value={gridExamId} 
                        onValueChange={(v) => { 
                          setGridExamId(v); 
                          setGridMarks({});
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select exam" />
                        </SelectTrigger>
                        <SelectContent>
                          {completedExams.filter(e => e?.id).map(e => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.name || `Exam ${e.id}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {gridExamId && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Class: {exams.find(e => String(e.id) === gridExamId)?.className || 'N/A'}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label>Class</Label>
                      <div className="mt-1 px-3 py-2 text-sm border border-border rounded-md bg-muted/30">
                        {gridExamId ? (
                          exams.find(e => String(e.id) === gridExamId)?.className || 'Select exam first'
                        ) : (
                          'Select an exam first'
                        )}
                      </div>
                    </div>
                  </div>

                  {gridStudents.length > 0 && gridExamId && gridSubjects.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {gridStudents.length} students × {gridSubjects.length} subjects
                        </p>
                        <Badge variant="outline" className="text-emerald-400 border-emerald-500/30">
                          {totalGridEntries} entries filled
                        </Badge>
                      </div>

                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/70 sticky top-0">
                              <th className="text-left px-4 py-3 font-medium sticky left-0 bg-muted/70 min-w-[160px]">Student</th>
                              {gridSubjects.map(sub => (
                                <th key={sub.id} className="px-3 py-3 text-center min-w-[90px] font-medium">
                                  {sub.code || sub.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {gridStudents.map((student, idx) => (
                              <tr key={student.id} className={idx % 2 === 0 ? "bg-background" : "bg-muted/30"}>
                                <td className="px-4 py-3 sticky left-0 bg-inherit font-medium">
                                  {student.name}
                                  <p className="text-xs text-muted-foreground">{student.rollNumber}</p>
                                </td>
                                {gridSubjects.map(sub => {
                                  const hasDup = isDuplicate(gridExamId, student.id, sub.id);
                                  return (
                                    <td key={sub.id} className="px-3 py-2 text-center">
                                      <Input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className={`w-20 h-9 text-center ${hasDup ? 'border-amber-500 bg-amber-500/10' : ''}`}
                                        placeholder="—"
                                        value={gridMarks[student.id]?.[sub.id] ?? ""}
                                        onChange={(e) => setGridMarks(prev => ({
                                          ...prev,
                                          [student.id]: {
                                            ...(prev[student.id] ?? {}),
                                            [sub.id]: e.target.value
                                          }
                                        }))}
                                      />
                                      {hasDup && <p className="text-[10px] text-amber-500 mt-0.5">Duplicate</p>}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Button
                        className="w-full"
                        disabled={totalGridEntries === 0 || createMutation.isPending}
                        onClick={handleGridSubmit}
                      >
                        {createMutation.isPending ? "Saving..." : `Save ${totalGridEntries} Result${totalGridEntries !== 1 ? "s" : ""}`}
                      </Button>
                    </div>
                  )}

                  {gridExamId && gridStudents.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No students found for this exam's class.
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Single Entry Dialog */}
            <Dialog 
              open={open} 
              onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (!isOpen) setForm(defaultForm);
              }}
            >
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4" /> Enter Result
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md w-[95vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Enter Single Exam Result</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 py-2">
                  <div>
                    <Label>Exam *</Label>
                    <Select 
                      value={form.examId} 
                      onValueChange={v => {
                        const exam = exams.find(e => String(e.id) === v);
                        setForm(f => ({
                          ...f,
                          examId: v,
                          studentId: "",
                          subjectId: "",
                          maxMarks: String(exam?.maxMarks || 100),
                        }));
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select exam" />
                      </SelectTrigger>
                      <SelectContent>
                        {completedExams.filter(e => e?.id).map(e => (
                          <SelectItem key={e.id} value={String(e.id)}>
                            {e.name || `Exam ${e.id}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.examId && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Class: {getSelectedFormExam()?.className || 'N/A'}
                        {getSelectedFormExam()?.isSupply ? " - failed students only" : ""}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Student *</Label>
                    <Select 
                      value={form.studentId} 
                      onValueChange={v => setForm(f => ({ ...f, studentId: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {getStudentsForExamDropdown().filter(s => s?.id).map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name || 'Unknown'} {s.rollNumber ? `(${s.rollNumber})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.examId && getStudentsForExamDropdown().length === 0 && (
                      <p className="text-xs text-amber-500 mt-1">
                        {getSelectedFormExam()?.isSupply ? "No failed students found for this supply exam." : "No students found for this exam's class"}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Subject *</Label>
                    <Select 
                      value={form.subjectId} 
                      onValueChange={v => {
                        const subject = subjects.find(s => String(s.id) === v);
                        setForm(f => ({ 
                          ...f, 
                          subjectId: v,
                          maxMarks: String(subject?.maxMarks || 100)
                        }));
                      }}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {getSubjectsForExamDropdown().filter(s => s?.id).map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>
                            {s.name || s.code || `Subject ${s.id}`}
                            {s.maxMarks && ` (Max: ${s.maxMarks})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form.examId && getSubjectsForExamDropdown().length === 0 && (
                      <p className="text-xs text-amber-500 mt-1">No subjects found for this exam's class</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Marks Obtained *</Label>
                      <Input
                        type="number"
                        min="0"
                        max={Number(form.maxMarks) || 100}
                        className="mt-1"
                        value={form.marksObtained}
                        onChange={e => {
                          const value = e.target.value;
                          const maxMarks = Number(form.maxMarks) || 100;
                          if (value === "" || Number(value) <= maxMarks) {
                            setForm(f => ({ ...f, marksObtained: value }));
                          }
                        }}
                        onBlur={() => {
                          const value = Number(form.marksObtained);
                          const maxMarks = Number(form.maxMarks) || 100;
                          if (value > maxMarks) {
                            setForm(f => ({ ...f, marksObtained: String(maxMarks) }));
                          }
                          if (value < 0) {
                            setForm(f => ({ ...f, marksObtained: "0" }));
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Max: {form.maxMarks}
                      </p>
                    </div>
                    <div>
                      <Label>Max Marks</Label>
                      <Input
                        type="text"
                        className="mt-1 bg-muted/30 cursor-not-allowed"
                        value={form.maxMarks}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Fixed value from subject
                      </p>
                    </div>
                  </div>

                  {/* DUPLICATE WARNING */}
                  {form.examId && form.studentId && form.subjectId && isDuplicate(form.examId, form.studentId, form.subjectId) && (
                    <div className="flex items-center gap-2 text-amber-500 text-sm bg-amber-500/10 p-3 rounded-lg">
                      <AlertTriangle className="w-5 h-5" />
                      This result already exists for this student, exam and subject.
                    </div>
                  )}

                  <Button
                    className="w-full"
                    disabled={
                      !form.examId || 
                      !form.studentId || 
                      !form.subjectId || 
                      !form.marksObtained || 
                      createMutation.isPending ||
                      (form.examId && form.studentId && form.subjectId && isDuplicate(form.examId, form.studentId, form.subjectId))
                    }
                    onClick={() => {
                      createMutation.mutate({
                        data: {
                          examId: parseInt(form.examId),
                          studentId: parseInt(form.studentId),
                          subjectId: parseInt(form.subjectId),
                          marksObtained: parseFloat(form.marksObtained),
                          maxMarks: parseFloat(form.maxMarks),
                        }
                      });
                      setOpen(false);
                      setForm(defaultForm);
                    }}
                  >
                    {createMutation.isPending ? "Saving..." : "Save Result"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Result Entries", value: scopedResults.length, color: "text-emerald-400", icon: BookOpen },
          { label: "Avg. Score", value: `${avgScore}%`, color: "text-blue-400", icon: BarChart2 },
          { label: "Pass Rate", value: `${passRate}%`, color: "text-emerald-400", icon: CheckCircle },
          { label: "Active Exams", value: activeExamsCount, color: "text-pink-400", icon: Trophy },
        ].map(s => (
          <Card key={s.label} className="glass-card border-t-2 border-t-emerald-500/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Results Table */}
      <Card className="glass-card border-t-2 border-t-emerald-500/30">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg font-serif">
            Recent Results ({totalItems})
            {totalItems > 0 && (
              <span className="text-sm font-normal text-muted-foreground ml-2">
                Page {safeCurrentPage} of {totalPages}
              </span>
            )}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="failures-filter"
                checked={showFailuresOnly}
                onChange={(e) => setShowFailuresOnly(e.target.checked)}
                className="rounded border-border text-emerald-500"
              />
              <label htmlFor="failures-filter" className="text-sm text-muted-foreground cursor-pointer">Failures Only</label>
            </div>

            <Select value={filterExam} onValueChange={setFilterExam}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="All Exams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Exams</SelectItem>
                {assignedResultExams.map(e => (
                  <SelectItem key={e.id} value={String(e.id)}>
                    {e.name || `Exam ${e.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="space-y-4 pt-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : currentItems.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Marks</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map(r => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={r.studentAvatarUrl} />
                            <AvatarFallback>{r.studentName?.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span>{r.studentName}</span>
                        </div>
                      </TableCell>
                      <TableCell>{r.subjectName}</TableCell>
                      <TableCell>{r.examName}</TableCell>
                      <TableCell>{r.marksObtained} / {r.maxMarks}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={gradeColors[r.grade]}>{r.grade}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="
                              bg-[color:var(--color-emerald-400)]/10
                              text-[color:var(--color-emerald-400)]
                              border border-[color:var(--color-emerald-400)]
                              hover:bg-[color:var(--color-emerald-400)]/20
                            "
                            onClick={() => handleDownloadReportCard(r.studentId, r.studentName, r.examId)}
                          >
                            Report Card
                          </Button>
                          
                          {/* Edit Button - only show for teachers/admin */}
                          {(isTeacher || isAdmin) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="
                                bg-blue-500/10
                                text-blue-400
                                border border-blue-400
                                hover:bg-blue-500/20
                                flex items-center gap-1
                              "
                              onClick={() => {
                                setEditingResult(r);
                                setEditForm({
                                  marksObtained: String(r.marksObtained),
                                  remarks: r.remarks || "",
                                });
                                setEditDialogOpen(true);
                              }}
                            >
                              <Edit className="w-3 h-3" />
                              Edit
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {((safeCurrentPage - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(safeCurrentPage * ITEMS_PER_PAGE, totalItems)} of {totalItems}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(safeCurrentPage - 1)}
                      disabled={safeCurrentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        // Show pages around current page
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (safeCurrentPage <= 3) {
                          pageNum = i + 1;
                        } else if (safeCurrentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = safeCurrentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={safeCurrentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8"
                            onClick={() => handlePageChange(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(safeCurrentPage + 1)}
                      disabled={safeCurrentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">No results found.</div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) {
          setEditingResult(null);
          setEditForm({ marksObtained: "", remarks: "" });
        }
      }}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Edit Exam Result</DialogTitle>
          </DialogHeader>
          
          {editingResult && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-4 rounded-lg text-sm space-y-1">
                <p><strong>Student:</strong> {editingResult.studentName}</p>
                <p><strong>Subject:</strong> {editingResult.subjectName}</p>
                <p><strong>Exam:</strong> {editingResult.examName}</p>
                <p><strong>Current Marks:</strong> {editingResult.marksObtained} / {editingResult.maxMarks}</p>
                <p><strong>Current Grade:</strong> {editingResult.grade}</p>
              </div>

              <div>
                <Label>New Marks Obtained *</Label>
                <Input
                  type="number"
                  min="0"
                  max={editingResult.maxMarks}
                  value={editForm.marksObtained}
                  onChange={e => {
                    const value = e.target.value;
                    const maxMarks = editingResult.maxMarks;
                    if (value === "" || Number(value) <= maxMarks) {
                      setEditForm(f => ({ ...f, marksObtained: value }));
                    }
                  }}
                  onBlur={() => {
                    const value = Number(editForm.marksObtained);
                    const maxMarks = editingResult.maxMarks;
                    if (value > maxMarks) {
                      setEditForm(f => ({ ...f, marksObtained: String(maxMarks) }));
                    }
                    if (value < 0) {
                      setEditForm(f => ({ ...f, marksObtained: "0" }));
                    }
                  }}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Max: {editingResult.maxMarks}
                </p>
              </div>

              <div>
                <Label>Remarks</Label>
                <Input
                  value={editForm.remarks}
                  onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                  placeholder="Optional remarks"
                  className="mt-1"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setEditDialogOpen(false);
                    setEditingResult(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!editForm.marksObtained || updateMutation.isPending}
                  onClick={async () => {
                    await updateMutation.mutateAsync({
                      id: editingResult.id,
                      data: {
                        marksObtained: parseFloat(editForm.marksObtained),
                        remarks: editForm.remarks || undefined,
                      }
                    });
                  }}
                >
                  {updateMutation.isPending ? "Saving..." : "Update"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Supplementary Dialog */}
      <Dialog open={!!suppOpen} onOpenChange={() => setSuppOpen(null)}>
        <DialogContent className="max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>Supplementary Marks</DialogTitle>
          </DialogHeader>
          {suppOpen && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/40 p-4 rounded-lg text-sm">
                <p><strong>Student:</strong> {suppOpen.studentName}</p>
                <p><strong>Subject:</strong> {suppOpen.subjectName}</p>
                <p><strong>Original Marks:</strong> {suppOpen.marksObtained} / {suppOpen.maxMarks}</p>
              </div>

              <div>
                <Label>New Marks</Label>
                <Input type="number" value={suppMarks} onChange={e => setSuppMarks(e.target.value)} className="mt-1" />
              </div>

              <div>
                <Label>Remarks</Label>
                <Input value={suppRemarks} onChange={e => setSuppRemarks(e.target.value)} placeholder="Passed in supplementary" className="mt-1" />
              </div>

              <Button className="w-full" onClick={handleSupplementarySubmit} disabled={!suppMarks || savingSupp}>
                {savingSupp ? "Saving..." : "Update Supplementary Marks"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

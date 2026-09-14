import { Router, Request, Response } from 'express';
import { prisma } from '../config/db';
import { requireTenantContext } from '../context/tenantContext';

const router = Router();

function grade(percent: number): string {
  if (percent >= 80) return 'A';
  if (percent >= 70) return 'B';
  if (percent >= 60) return 'C';
  if (percent >= 50) return 'D';
  return 'F';
}

// GET /api/v1/school/report-cards?studentId=&termId=
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId } = requireTenantContext();
    const { studentId, termId } = req.query as { studentId?: string; termId?: string };

    if (!studentId || !termId) {
      res.status(400).json({ success: false, error: 'studentId and termId are required' });
      return;
    }

    const [student, term, assessments, attendanceRecords] = await Promise.all([
      prisma.student.findFirst({ where: { id: studentId, tenantId } }),
      prisma.academicTerm.findFirst({ where: { id: termId, tenantId } }),
      prisma.studentAssessment.findMany({ where: { tenantId, studentId, termId } }),
      prisma.schoolAttendance.findMany({ where: { tenantId, studentId, termId } }),
    ]);

    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }
    if (!term) {
      res.status(404).json({ success: false, error: 'Term not found' });
      return;
    }

    const subjects = assessments.map((a) => {
      const sc = Number(a.score);
      const mx = Number(a.maxScore);
      const pct = mx > 0 ? Math.round((sc / mx) * 100) : 0;
      return {
        name: a.subjectName,
        examType: a.examType,
        score: sc,
        maxScore: mx,
        percent: pct,
        grade: grade(pct),
      };
    });

    const totalScore = subjects.reduce((s, sub) => s + sub.score, 0);
    const totalMaxScore = subjects.reduce((s, sub) => s + sub.maxScore, 0);
    const overallPercent = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

    const presentCount = attendanceRecords.filter((a) => a.status === 'PRESENT').length;
    const absentCount = attendanceRecords.filter((a) => a.status === 'ABSENT').length;
    const lateCount = attendanceRecords.filter((a) => a.status === 'LATE').length;
    const total = attendanceRecords.length;

    res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          studentCode: student.studentCode,
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.className,
        },
        term: { id: term.id, name: term.name, academicYear: term.academicYear },
        subjects,
        attendanceSummary: { present: presentCount, absent: absentCount, late: lateCount, total },
        overallPercent,
        overallGrade: grade(overallPercent),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

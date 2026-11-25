import { jsPDF } from 'jspdf';
import type {
  AutomatedTestCaseResult,
  BuildRecordItem,
  QolbuAuditReport,
  StudioProjectState,
} from './types';

export function exportBuildAnalysisPdf(
  project: StudioProjectState,
  builds: BuildRecordItem[],
  tests: AutomatedTestCaseResult[],
  audit: QolbuAuditReport
) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 48;

  const line = (text: string, size = 10, bold = false, color: [number, number, number] = [30, 41, 59]) => {
    if (y > 770) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const wrapped = doc.splitTextToSize(text, 500) as string[];
    doc.text(wrapped, 48, y);
    y += wrapped.length * (size + 4) + 2;
  };

  line(`MungilEngine V13 / Qolbu AAA Build Analysis Report`, 18, true, [15, 23, 42]);
  line(`Project: ${project.brief.title}  |  Genre: ${project.brief.genre}  |  Branch: ${project.activeBranch}`, 10, false, [71, 85, 105]);
  line(`Target Hardware: ${project.brief.targetDevice}  |  Generated: ${new Date().toISOString()}`, 9, false, [100, 116, 139]);
  y += 10;

  line('1. GDD & Design Pillars', 13, true, [15, 23, 42]);
  line(project.gdd.highConcept, 10);
  project.gdd.pillars.forEach((p, idx) => line(`  ${idx + 1}. ${p}`, 9.5));
  y += 8;

  line('2. Qolbu v13.0 Itel A70 8-Stage Verification', 13, true, [15, 23, 42]);
  audit.stages.forEach((st) => {
    line(
      `  [${st.passed ? 'PASS' : 'FAIL'}] Stage ${st.stage}: ${st.name} — ${st.metric} (Target: ${st.target})`,
      9.5,
      false,
      st.passed ? [22, 101, 52] : [185, 28, 28]
    );
  });
  y += 8;

  line('3. Automated Logic & State Machine Tests', 13, true, [15, 23, 42]);
  tests.forEach((t) => {
    line(`  [${t.passed ? 'PASS' : 'FAIL'}] ${t.suite}: ${t.name} (${t.durationMs}ms) — ${t.detail}`, 9.5);
  });
  y += 8;

  line('4. Recent Build History', 13, true, [15, 23, 42]);
  builds.slice(0, 6).forEach((b) => {
    line(
      `  ${b.versionTag} [${b.status.toUpperCase()}] ${b.targetPlatform} · CPU ${b.cpuMs}ms · GPU ${b.gpuMs}ms · ${b.drawCalls} DC · ${b.memoryMb} MB · ${b.fpsAvg} FPS`,
      9.5
    );
  });

  const slug = project.brief.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 28) || 'mungil-build';
  doc.save(`${slug}-build-analysis.pdf`);
}

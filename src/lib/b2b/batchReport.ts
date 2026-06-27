import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface BatchReportOptions {
  includeProfile: boolean;
  includeCredits: boolean;
  includeSessions: boolean;
  includeOverallReadiness: boolean;
  includeDetailedBreakdown: boolean;
}

export function generateBatchReportPDF(
  batch: any, 
  mentees: any[], 
  options: BatchReportOptions,
  mentorName: string,
  instituteName: string = "AI Preparation Coach"
) {
  const doc = new jsPDF();
  const primaryColor = '#0d9488'; // teal-600
  
  // --- Header ---
  doc.setFillColor(primaryColor);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor('#ffffff');
  doc.setFontSize(22);
  doc.text('BATCH PERFORMANCE REPORT', 14, 25);
  
  doc.setFontSize(10);
  doc.text(instituteName, 140, 18);
  
  const reportDate = new Date().toLocaleDateString();
  doc.text(`Date: ${reportDate}`, 140, 24);
  
  // --- Batch Info ---
  doc.setTextColor('#333333');
  doc.setFontSize(14);
  doc.text(`Batch: ${batch.name || 'Unnamed Batch'}`, 14, 55);
  doc.setFontSize(11);
  doc.setTextColor('#666666');
  doc.text(`Mentor: ${mentorName}`, 14, 62);
  doc.text(`Total Mentees: ${mentees.length}`, 14, 68);
  doc.text(`Department: ${batch.department || 'N/A'}`, 14, 74);

  let currentY = 90;

  // --- Tier Distribution Graph ---
  if (mentees.length > 0) {
    const tiers = {
      'Tier 1': 0,
      'Tier 2': 0,
      'Tier 3': 0,
      'Insufficient Data': 0
    };

    mentees.forEach(m => {
      const tier = m.readiness?.tier || 'Insufficient Data';
      if (tiers[tier as keyof typeof tiers] !== undefined) {
        tiers[tier as keyof typeof tiers]++;
      }
    });

    doc.setFontSize(12);
    doc.setTextColor('#333333');
    doc.text('Placement Readiness Distribution', 14, currentY);
    
    currentY += 10;
    
    const maxCount = Math.max(...Object.values(tiers));
    const barMaxWidth = 100;
    const barHeight = 8;
    const gap = 12;
    
    const colors = {
      'Tier 1': '#10b981', // emerald-500
      'Tier 2': '#06b6d4', // cyan-500
      'Tier 3': '#f59e0b', // amber-500
      'Insufficient Data': '#9ca3af' // gray-400
    };

    Object.entries(tiers).forEach(([tier, count], index) => {
      const y = currentY + (index * gap);
      
      // Label
      doc.setFontSize(9);
      doc.setTextColor('#666666');
      doc.text(tier, 14, y + 6);
      
      // Bar
      const width = maxCount > 0 ? (count / maxCount) * barMaxWidth : 0;
      doc.setFillColor(colors[tier as keyof typeof colors]);
      doc.rect(50, y, width, barHeight, 'F');
      
      // Value
      doc.setTextColor('#333333');
      doc.setFontSize(9);
      doc.text(count.toString(), 50 + width + 3, y + 6);
    });

    currentY += (4 * gap) + 15;
  }

  // --- Table Generation ---
  const head: string[][] = [['Student Name', 'Email']];
  
  if (options.includeProfile) head[0].push('Degree & Course');
  if (options.includeCredits) head[0].push('Credits (Used/Rem)');
  if (options.includeSessions) head[0].push('Sessions');
  if (options.includeOverallReadiness) head[0].push('Tier (Score)');
  if (options.includeDetailedBreakdown) {
    head[0].push('Comm.');
    head[0].push('Tech.');
    head[0].push('Interview');
  }

  const body: string[][] = mentees.map(m => {
    const row = [m.fullName || 'Unknown', m.email || 'N/A'];
    
    if (options.includeProfile) {
      row.push(`${m.profile?.degree || 'N/A'} - ${m.profile?.course || 'N/A'}`);
    }
    
    if (options.includeCredits) {
      row.push(`${m.credits?.used || 0} / ${m.credits?.remaining || 0}`);
    }
    
    if (options.includeSessions) {
      row.push(`${m.sessionCount || 0}`);
    }
    
    if (options.includeOverallReadiness) {
      row.push(`${m.readiness?.tier || 'N/A'} ${m.readiness?.score !== undefined ? `(${m.readiness.score})` : ''}`);
    }
    
    if (options.includeDetailedBreakdown) {
      row.push(`${Math.round(m.readiness?.breakdown?.communication || 0)}`);
      row.push(`${Math.round(m.readiness?.breakdown?.technical || 0)}`);
      row.push(`${Math.round(m.readiness?.breakdown?.interview || 0)}`);
    }

    return row;
  });

  autoTable(doc, {
    startY: currentY,
    head: head,
    body: body,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: '#ffffff' },
    styles: { fontSize: 8, cellPadding: 3 },
    margin: { top: 10, left: 14, right: 14 }
  });

  // --- Footer ---
  const pageCount = (doc as any).internal.getNumberOfPages();
  doc.setFontSize(8);
  doc.setTextColor('#888888');
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Page ${i} of ${pageCount}`, 105, 290, { align: 'center' });
  }
  
  // Download
  doc.save(`${batch.name?.replace(/\s+/g, '_')}_Report.pdf`);
}

import { jsPDF } from 'jspdf';
import { InstitutePlan, InstituteBranding } from './registry';

interface InvoiceData {
  collegeName: string;
  representativeName: string;
  representativeEmail: string;
  location: string;
  plan: InstitutePlan;
  branding?: InstituteBranding;
  activatedAt: Date | null;
}

export function generateInvoicePDF(data: InvoiceData) {
  const doc = new jsPDF();
  const primaryColor = data.branding?.primaryColor || '#6b21a8'; // Default purple
  
  // Header Background
  doc.setFillColor(primaryColor);
  doc.rect(0, 0, 210, 40, 'F');
  
  // Header Text
  doc.setTextColor('#ffffff');
  doc.setFontSize(22);
  doc.text('INVOICE', 14, 25);
  
  doc.setFontSize(10);
  doc.text('AI Preparation Coach', 140, 18);
  doc.text('contact@aicoach.com', 140, 24);
  
  // Invoice Details
  doc.setTextColor('#333333');
  doc.setFontSize(12);
  doc.text('Bill To:', 14, 55);
  
  doc.setFontSize(10);
  doc.text(data.collegeName, 14, 62);
  doc.text(data.representativeName, 14, 68);
  doc.text(data.representativeEmail, 14, 74);
  doc.text(data.location || '', 14, 80);
  
  const invoiceDate = data.activatedAt ? new Date(data.activatedAt).toLocaleDateString() : new Date().toLocaleDateString();
  
  doc.text(`Invoice Date: ${invoiceDate}`, 140, 62);
  doc.text(`Status: PAID`, 140, 68);
  
  // Line Items Header
  doc.setFillColor(primaryColor);
  doc.rect(14, 95, 182, 10, 'F');
  doc.setTextColor('#ffffff');
  doc.setFontSize(10);
  doc.text('Description', 16, 101);
  doc.text('Duration', 110, 101);
  doc.text('Credits', 160, 101);
  
  // Line Items
  doc.setTextColor('#333333');
  doc.setFontSize(10);
  
  const portals = data.plan?.enabledPortals?.join(', ') || 'N/A';
  const description = `AI Coach B2B Plan - ${portals}`;
  doc.text(description, 16, 115);
  doc.text(data.plan?.duration || 'N/A', 110, 115);
  doc.text(data.plan?.totalCredits?.toString() || '0', 160, 115);
  
  // Footer
  doc.setFontSize(10);
  doc.setTextColor('#888888');
  doc.text('Thank you for your business.', 105, 280, { align: 'center' });
  
  doc.save(`${data.collegeName.replace(/\s+/g, '_')}_Invoice.pdf`);
}

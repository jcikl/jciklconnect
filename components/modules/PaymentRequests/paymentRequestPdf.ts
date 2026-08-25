import type { BankAccount, PaymentRequest, Project } from '../../../types';
import { formatCurrency } from '../../../utils/formatUtils';

interface GeneratePaymentRequestPdfPreviewOptions {
  request: PaymentRequest;
  projects: Project[];
  bankAccounts: BankAccount[];
  onMergeError?: () => void;
}

interface PaymentRequestPdfPreviewResult {
  url: string;
  fileName: string;
}

export const generatePaymentRequestPdfPreview = async ({
  request,
  projects,
  bankAccounts,
  onMergeError,
}: GeneratePaymentRequestPdfPreviewOptions): Promise<PaymentRequestPdfPreviewResult> => {
  const [{ jsPDF }, { PDFDocument }] = await Promise.all([
    import('jspdf'),
    import('pdf-lib'),
  ]);
  const doc = new jsPDF();
  const primaryColor = [0, 151, 215];
  const secondaryColor = [243, 156, 18];
  const lightGray = [248, 250, 252];
  const borderGray = [226, 232, 240];
  const textMain = [30, 41, 59];
  const textSecondary = [100, 116, 139];

  const img = new Image();
  img.src = '/JCI Kuala Lumpur-transparent.png';
  await new Promise((resolve) => {
    img.onload = resolve;
    img.onerror = resolve;
  });

  const jciBlue = [0, 151, 215];
  const jciGold = [237, 189, 39];

  if (img.complete && img.naturalWidth > 0) {
    const logoH = 16;
    const logoW = (img.naturalWidth * logoH) / img.naturalHeight;
    doc.addImage(img, 'PNG', 15, 12, logoW, logoH);
  }

  const infoX = 55;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);

  doc.setTextColor(jciBlue[0], jciBlue[1], jciBlue[2]);
  doc.text("JCI", infoX, 16.5);
  const jciWidth = doc.getTextWidth("JCI ");

  doc.setTextColor(jciGold[0], jciGold[1], jciGold[2]);
  doc.text("Kuala Lumpur (Malaysia)", infoX + jciWidth, 16.5);
  const klWidth = doc.getTextWidth("Kuala Lumpur (Malaysia) ");

  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("Established since 1954", infoX + jciWidth + klWidth, 16.5);

  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.setFontSize(8);
  doc.text("25-3-2, Jalan 3/50, Off, Jln Gombak, Diamond Square, 53000 Kuala Lumpur", infoX, 21);
  doc.text("Patron: JCI Senator Dato™ Seri Dr Derek Goh BBM(L)", infoX, 24);

  doc.setTextColor(jciBlue[0], jciBlue[1], jciBlue[2]);
  doc.text("www.jcikl.cc", infoX, 28, { link: { url: "https://www.jcikl.cc" } } as any);
  doc.text("\u2022", infoX + 18, 28);
  doc.text("www.jcimalaysia.cc", infoX + 21, 28, { link: { url: "https://www.jcimalaysia.cc" } } as any);
  doc.text("\u2022", infoX + 46, 28);
  doc.text("www.jci.cc", infoX + 49, 28, { link: { url: "https://www.jci.cc" } } as any);

  let y = 40;
  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT REQUEST", 105, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`REF: ${request.referenceNumber}`, 105, y, { align: "center" });

  y += 10;

  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("APPLICANT DETAILS", 15, y);
  y += 4;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(15, y, 30, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.setFont("helvetica", "normal");

  doc.text("Name", 15, y);
  doc.text("Position", 15, y + 5);

  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFont("helvetica", "bold");
  doc.text(request.applicantName || 'N/A', 40, y);
  doc.text(request.applicantPosition || 'N/A', 40, y + 5);

  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.setFont("helvetica", "normal");
  doc.text("Date", 120, y);
  doc.text("Category", 120, y + 5);
  doc.text("Project", 120, y + 10);

  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFont("helvetica", "bold");
  doc.text(request.date || 'N/A', 145, y);
  doc.text(request.category === 'administrative' ? 'Administrative' : 'Projects & Activities', 145, y + 5);
  const projectName = request.category === 'administrative'
    ? request.activityId
    : (projects.find(p => p.id === request.activityId)?.name || request.activityRef || 'N/A');
  const splitProject = doc.splitTextToSize(String(projectName), 45);
  doc.text(splitProject, 145, y + 10);

  y += 20;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CLAIM BREAKDOWN", 15, y);
  y += 4;
  doc.line(15, y, 30, y);
  y += 8;

  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(15, y, 180, 10, 'F');
  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("No.", 20, y + 6);
  doc.text("Description / Purpose", 35, y + 6);
  doc.text("Amount (RM)", 190, y + 6, { align: "right" });
  y += 10;

  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  (request.items || []).forEach((item, idx) => {
    if (idx % 2 === 1) {
      doc.setFillColor(252, 253, 254);
      doc.rect(15, y, 180, 10, 'F');
    }
    doc.text(String(idx + 1), 20, y + 6);
    doc.text(item.purpose, 35, y + 6);
    doc.text(Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 }), 190, y + 6, { align: "right" });

    doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
    doc.setLineWidth(0.1);
    doc.line(15, y + 10, 195, y + 10);

    y += 10;
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
  });

  y += 5;
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(130, y, 65, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", 135, y + 7.5);
  doc.text(formatCurrency(request.totalAmount || request.amount), 190, y + 7.5, { align: "right" });

  let footerY = 200;

  if (request.remark) {
    doc.setTextColor(textMain[0], textMain[1], textMain[2]);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("REMARKS", 15, footerY);
    footerY += 3;
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.5);
    doc.line(15, footerY, 30, footerY);
    footerY += 5;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
    const lines = doc.splitTextToSize(request.remark, 175);
    doc.text(lines, 15, footerY);
    footerY += lines.length * 3.5 + 5;
  }

  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("PAYMENT METHOD", 15, footerY);
  footerY += 3;
  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setLineWidth(0.5);
  doc.line(15, footerY, 30, footerY);
  footerY += 5;

  doc.setFillColor(lightGray[0], lightGray[1], lightGray[2]);
  doc.rect(15, footerY, 180, 30, 'F');
  doc.setDrawColor(borderGray[0], borderGray[1], borderGray[2]);
  doc.rect(15, footerY, 180, 30, 'S');

  const labelX = 20;
  const valueX = 55;
  const splitX = 105;

  doc.setFontSize(8);
  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.setFont("helvetica", "normal");

  doc.text("Claim From", labelX, footerY + 7);
  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFont("helvetica", "bold");
  const bankAcc = bankAccounts.find(a => a.id === request.claimFromBankAccountId);
  doc.text(bankAcc?.name || 'N/A', valueX, footerY + 7);

  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.setFont("helvetica", "normal");
  doc.text("Recipient Bank", labelX, footerY + 14);
  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFont("helvetica", "bold");
  doc.text(request.bankName || 'N/A', valueX, footerY + 14);

  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.setFont("helvetica", "normal");
  doc.text("Account Holder", labelX, footerY + 21);
  doc.text("Account Number", splitX, footerY + 21);

  doc.setTextColor(textMain[0], textMain[1], textMain[2]);
  doc.setFont("helvetica", "bold");
  doc.text(request.accountHolder || 'N/A', labelX, footerY + 27);
  doc.text(request.accountNumber || 'N/A', splitX, footerY + 27);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(textSecondary[0], textSecondary[1], textSecondary[2]);
  doc.text(`Generated by JCI Connect Digital Finance on ${new Date().toLocaleString()}`, 105, 285, { align: "center" });
  doc.text("This is a computer-generated document and no signature is required.", 105, 289, { align: "center" });

  const attachmentUrls = request.attachmentUrls || [];
  let finalBlobUrl = '';

  if (attachmentUrls.length > 0) {
    try {
      const mainPdfBytes = doc.output('arraybuffer');
      const mergedPdf = await PDFDocument.load(mainPdfBytes);

      for (const url of attachmentUrls) {
        try {
          const resp = await fetch(url);
          const fileBytes = await resp.arrayBuffer();
          const contentType = resp.headers.get('content-type') || '';

          if (contentType.includes('pdf')) {
            const attachmentPdf = await PDFDocument.load(fileBytes);
            const copiedPages = await mergedPdf.copyPages(attachmentPdf, attachmentPdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
          } else if (contentType.includes('image')) {
            const image = contentType.includes('png')
              ? await mergedPdf.embedPng(fileBytes)
              : await mergedPdf.embedJpg(fileBytes);

            const page = mergedPdf.addPage();
            const { width, height } = page.getSize();
            const imgDims = image.scaleToFit(width - 40, height - 40);
            page.drawImage(image, {
              x: width / 2 - imgDims.width / 2,
              y: height / 2 - imgDims.height / 2,
              width: imgDims.width,
              height: imgDims.height,
            });
          }
        } catch (fileErr) {
          console.warn('Failed to attach file (skipped):', url, fileErr);
        }
      }

      const finalPdfBytes = await mergedPdf.save();
      const blob = new Blob([finalPdfBytes as BlobPart], { type: 'application/pdf' });
      finalBlobUrl = URL.createObjectURL(blob);
    } catch (mergeErr) {
      console.error('PDF merging failed, falling back to basic PDF:', mergeErr);
      onMergeError?.();
      finalBlobUrl = doc.output('bloburl').toString();
    }
  } else {
    finalBlobUrl = doc.output('bloburl').toString();
  }

  return {
    url: finalBlobUrl,
    fileName: `${request.referenceNumber || 'payment-request'}.pdf`,
  };
};

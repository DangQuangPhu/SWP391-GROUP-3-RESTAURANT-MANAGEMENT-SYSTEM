import ExcelJS from "exceljs";
import PdfPrinterPkg from "pdfmake/js/Printer.js";
import URLResolverPkg from "pdfmake/js/URLResolver.js";
import vfsPkg from "pdfmake/js/virtual-fs.js";
import path from "path";

const PdfPrinter = PdfPrinterPkg.default || PdfPrinterPkg;
const URLResolver = URLResolverPkg.default || URLResolverPkg;
const vfs = vfsPkg.default || vfsPkg;
const resolver = new URLResolver(vfs);

// Define fonts for pdfmake.
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};
// Note: for production with Vietnamese characters, we should load actual ttf files.
// For now, using standard Helvetica (built-in) which supports basic characters. 
// If pdfmake fails with Vietnamese on Helvetica, we will just pass strings as is and hope for the best, 
// or ideally provide a TTF. But pdfmake's default Roboto doesn't support VN well unless we bundle it.
// To avoid complex setups, we'll use the standard fonts.

export async function generateExcelBuffer(dataset, grandTotalRow, intent) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report");

  if (!dataset || dataset.length === 0) {
    sheet.addRow(["No data available for the selected criteria."]);
    return await workbook.xlsx.writeBuffer();
  }

  // Generate headers from the keys of the first row
  const columns = Object.keys(dataset[0]);
  
  // Add Title
  sheet.addRow([`Report Type: ${intent.report_type}`]);
  sheet.addRow([`Date Range: ${intent.date_range?.from || '*'} to ${intent.date_range?.to || '*'}`]);
  sheet.addRow([]);

  // Add Headers
  const headerRow = sheet.addRow(columns.map(col => col.toUpperCase().replace(/_/g, ' ')));
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
  });

  // Add Data Rows
  dataset.forEach(row => {
    const rowValues = columns.map(col => row[col]);
    const addedRow = sheet.addRow(rowValues);
    
    // Format currency columns if applicable
    if (columns.includes("total_amount")) {
      const idx = columns.indexOf("total_amount") + 1;
      addedRow.getCell(idx).numFmt = '#,##0 "VND"';
    }
  });

  // Add Grand Total Row if present
  if (grandTotalRow) {
    const totalRowValues = columns.map((col, i) => {
      if (col === "total_amount") return grandTotalRow[col];
      if (i === 0) return "TỔNG CỘNG";
      return "";
    });
    const totalSheetRow = sheet.addRow(totalRowValues);
    totalSheetRow.font = { bold: true };
    if (columns.includes("total_amount")) {
      totalSheetRow.getCell(columns.indexOf("total_amount") + 1).numFmt = '#,##0 "VND"';
    }
  }

  // Auto-fit columns roughly
  sheet.columns.forEach(column => {
    column.width = 20;
  });

  return await workbook.xlsx.writeBuffer();
}

export function generatePdfBuffer(dataset, grandTotalRow, intent) {
  return new Promise(async (resolve, reject) => {
    try {
      const printer = new PdfPrinter(fonts, vfs, resolver);
      
      if (!dataset || dataset.length === 0) {
        const docDef = { content: ["No data available for the selected criteria."] };
        const pdfDoc = await printer.createPdfKitDocument(docDef);
        const chunks = [];
        pdfDoc.on('data', chunk => chunks.push(chunk));
        pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
        pdfDoc.end();
        return;
      }

      const columns = Object.keys(dataset[0]);
      
      const tableBody = [];
      
      // Header
      tableBody.push(columns.map(col => ({ text: col.toUpperCase().replace(/_/g, ' '), style: 'tableHeader' })));
      
      // Data
      dataset.forEach(row => {
        tableBody.push(columns.map(col => {
          let val = row[col];
          if (col === "total_amount" && typeof val === "number") {
             val = val.toLocaleString("vi-VN") + " VND";
          } else if (typeof val === "number") {
             val = val.toLocaleString("vi-VN");
          }
          return (val !== null && val !== undefined) ? String(val) : "";
        }));
      });

      // Total
      if (grandTotalRow) {
        const totalRowValues = columns.map((col, i) => {
          let val = grandTotalRow[col];
          if (col === "total_amount" && typeof val === "number") {
             val = val.toLocaleString("vi-VN") + " VND";
          } else if (typeof val === "number") {
             val = val.toLocaleString("vi-VN");
          }
          if (i === 0 && (val === undefined || val === null || val === "")) val = "TỔNG CỘNG";
          return { text: (val !== null && val !== undefined) ? String(val) : "", style: 'tableTotal' };
        });
        tableBody.push(totalRowValues);
      }

      const docDefinition = {
        pageOrientation: columns.length > 5 ? 'landscape' : 'portrait',
        content: [
          { text: `Report: ${intent.report_type}`, style: 'header' },
          { text: `Date Range: ${intent.date_range?.from || '*'} to ${intent.date_range?.to || '*'}`, style: 'subheader' },
          { text: `Customer Filter: ${intent.customer_type_filter || intent.filters?.customer_type || 'all'}`, style: 'subheader' },
          { text: '\n' },
          {
            table: {
              headerRows: 1,
              widths: columns.map(col => (col === 'date' || col === 'customer_name') ? 140 : '*'),
              body: tableBody
            },
            layout: {
              fillColor: function (rowIndex) {
                if (rowIndex === 0) return '#f3f4f6';
                if (rowIndex === tableBody.length - 1 && grandTotalRow) return '#fef9c3';
                return (rowIndex % 2 === 0) ? '#fafafa' : null;
              },
              hLineWidth: function (i, node) {
                return (i === 0 || i === node.table.body.length || i === node.table.body.length - 1) ? 1.5 : 0.5;
              },
              vLineWidth: function () { return 0; },
              hLineColor: function (i, node) {
                return (i === 0 || i === node.table.body.length) ? '#374151' : '#e5e7eb';
              }
            }
          }
        ],
        styles: {
          header: { fontSize: 18, bold: true, margin: [0, 0, 0, 5], color: '#111827' },
          subheader: { fontSize: 11, margin: [0, 0, 0, 2], color: '#4b5563' },
          tableHeader: { bold: true, fontSize: 10, color: '#111827' },
          tableTotal: { bold: true, fontSize: 11, color: '#854d0e' }
        },
        defaultStyle: {
          font: 'Roboto'
        }
      };

      const pdfDoc = await printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data', chunk => chunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
      pdfDoc.on('error', err => reject(err));
      pdfDoc.end();
    } catch (err) {
      reject(err);
    }
  });
}

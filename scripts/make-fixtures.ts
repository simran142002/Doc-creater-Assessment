import { writeFileSync } from "node:fs";
import { AlignmentType, Document, HeadingLevel, LevelFormat, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from "docx";

const doc = new Document({
  numbering: {
    config: [{ reference: "num", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.START }] }],
  },
  sections: [{
    children: [
      new Paragraph({ text: "Quarterly plan", heading: HeadingLevel.HEADING_1 }),
      new Paragraph({ text: "Goals", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ children: [new TextRun({ text: "Bold", bold: true }), new TextRun(" and "), new TextRun({ text: "italic", italics: true }), new TextRun(" and "), new TextRun({ text: "underlined", underline: {} })] }),
      new Paragraph({ text: "First bullet", bullet: { level: 0 } }),
      new Paragraph({ text: "Second bullet", bullet: { level: 0 } }),
      new Paragraph({ text: "Step one", numbering: { reference: "num", level: 0 } }),
      new Paragraph({ text: "Step two", numbering: { reference: "num", level: 0 } }),
      new Table({ rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph("cell A")] }), new TableCell({ children: [new Paragraph("cell B")] })] })] }),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  writeFileSync("tests/fixtures/sample.docx", buf);
  console.log("wrote tests/fixtures/sample.docx");
});

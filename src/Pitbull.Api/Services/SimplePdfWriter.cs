using System.Globalization;
using System.Text;

namespace Pitbull.Api.Services;

/// <summary>
/// MIT-licensed table PDF writer using the 14 standard PDF fonts (no extra SDK, no font files).
/// Produces real PDF 1.4 bytes with a <c>%PDF</c> header.
/// </summary>
internal static class SimplePdfWriter
{
    private const float LetterPortraitWidth = 612f;
    private const float LetterPortraitHeight = 792f;
    private const float LetterLandscapeWidth = 792f;
    private const float LetterLandscapeHeight = 612f;

    internal static byte[] WriteTable(
        string companyName,
        string title,
        DateTime reportDate,
        IReadOnlyList<string> headers,
        IReadOnlyList<string[]> rows,
        IReadOnlyList<string> totals,
        bool landscape = false)
    {
        var pageWidth = landscape ? LetterLandscapeWidth : LetterPortraitWidth;
        var pageHeight = landscape ? LetterLandscapeHeight : LetterPortraitHeight;
        const float margin = 36f;
        const float headerBand = 52f;
        const float footerBand = 28f;
        const float rowHeight = 16f;
        const float headerRowHeight = 18f;
        var fontSize = landscape ? 7f : 9f;
        var contentTop = margin + headerBand;
        var contentBottom = margin + footerBand;
        var usableWidth = pageWidth - margin * 2;
        var colCount = Math.Max(headers.Count, 1);
        var colWidth = usableWidth / colCount;

        var bodyAndTotals = new List<string[]>(rows.Count + 1);
        bodyAndTotals.AddRange(rows);
        bodyAndTotals.Add(totals.ToArray());

        var pages = new List<PageContent>();
        var rowIndex = 0;
        while (true)
        {
            var y = contentTop;
            var ops = new StringBuilder();
            DrawLetterhead(ops, companyName, title, reportDate, pageWidth, pageHeight, margin);
            DrawHLine(ops, margin, pageHeight - (margin + headerBand - 8), pageWidth - margin, 1f, 0.75f);

            DrawTableRow(ops, headers, pageHeight, margin, y, colWidth, headerRowHeight, fontSize, header: true);
            y += headerRowHeight;

            var rowsThisPage = 0;
            while (rowIndex < bodyAndTotals.Count)
            {
                if (y + rowHeight > pageHeight - contentBottom)
                    break;
                var isTotal = rowIndex == bodyAndTotals.Count - 1;
                DrawTableRow(ops, bodyAndTotals[rowIndex], pageHeight, margin, y, colWidth, rowHeight, fontSize, header: isTotal);
                y += rowHeight;
                rowIndex++;
                rowsThisPage++;
            }

            if (rowsThisPage == 0 && rowIndex < bodyAndTotals.Count)
            {
                // Pathological: one row taller than the page. Force it so we cannot hang.
                DrawTableRow(ops, bodyAndTotals[rowIndex], pageHeight, margin, y, colWidth, rowHeight, fontSize, header: false);
                rowIndex++;
            }

            pages.Add(new PageContent(ops.ToString(), pageWidth, pageHeight));
            if (rowIndex >= bodyAndTotals.Count)
                break;
        }

        return BuildDocument(pages, companyName, reportDate);
    }

    internal static byte[] WriteWh347(Wh347PdfModel model)
    {
        const float pageWidth = LetterLandscapeWidth;
        const float pageHeight = LetterLandscapeHeight;
        const float margin = 18f;
        const float fontSize = 6.5f;
        const float rowHeight = 11f;

        string[] headers =
        [
            "(1) Name", "(2) Ex.", "(3) Class", "OT/ST",
            "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun",
            "Hours", "Rate", "Gross", "FICA", "W/H", "Other", "Net"
        ];
        float[] widths =
        [
            110, 28, 70, 24,
            28, 28, 28, 28, 28, 28, 28,
            32, 40, 48, 36, 36, 32, 48
        ];

        var tableRows = new List<string[]>();
        foreach (var row in model.Rows)
        {
            tableRows.Add(
            [
                $"{row.EmployeeName}\n#{row.EmployeeNumber}",
                "",
                row.Classification,
                "ST",
                Hrs(row.MonHours), Hrs(row.TueHours), Hrs(row.WedHours), Hrs(row.ThuHours),
                Hrs(row.FriHours), Hrs(row.SatHours), Hrs(row.SunHours),
                row.StraightTimeHours.ToString("N1", CultureInfo.InvariantCulture),
                Money(row.Rate), Money(row.GrossPay), Money(row.Fica), Money(row.Withholding),
                row.OtherDeductions > 0 ? Money(row.OtherDeductions) : "",
                Money(row.NetPay)
            ]);
            tableRows.Add(
            [
                "",
                "",
                "",
                "OT",
                "", "", "", "", "", "", "",
                row.OvertimeHours > 0 ? row.OvertimeHours.ToString("N1", CultureInfo.InvariantCulture) : "",
                "", "", "", "", "", ""
            ]);
        }

        tableRows.Add(
        [
            "TOTALS", "", "", "",
            Hrs(model.Rows.Sum(r => r.MonHours)),
            Hrs(model.Rows.Sum(r => r.TueHours)),
            Hrs(model.Rows.Sum(r => r.WedHours)),
            Hrs(model.Rows.Sum(r => r.ThuHours)),
            Hrs(model.Rows.Sum(r => r.FriHours)),
            Hrs(model.Rows.Sum(r => r.SatHours)),
            Hrs(model.Rows.Sum(r => r.SunHours)),
            (model.Rows.Sum(r => r.StraightTimeHours) + model.Rows.Sum(r => r.OvertimeHours)).ToString("N1", CultureInfo.InvariantCulture),
            "",
            Money(model.Rows.Sum(r => r.GrossPay)),
            Money(model.Rows.Sum(r => r.Fica)),
            Money(model.Rows.Sum(r => r.Withholding)),
            Money(model.Rows.Sum(r => r.OtherDeductions)),
            Money(model.Rows.Sum(r => r.NetPay))
        ]);

        var pages = new List<PageContent>();
        var rowIndex = 0;
        var firstPage = true;
        while (true)
        {
            var ops = new StringBuilder();
            var y = margin;

            if (firstPage)
            {
                y = DrawWh347Header(ops, model, pageWidth, pageHeight, margin, y);
                firstPage = false;
            }
            else
            {
                DrawText(ops, "WH-347 (continued)", margin, pageHeight - y - 10, 9, bold: true);
                y += 16;
            }

            DrawTableRowVariable(ops, headers, widths, pageHeight, margin, y, 16f, fontSize, header: true);
            y += 16f;

            var rowsThisPage = 0;
            var complianceReserve = 140f;
            while (rowIndex < tableRows.Count)
            {
                var remaining = pageHeight - margin - 24 - y;
                var needCompliance = rowIndex == tableRows.Count - 1;
                if (remaining < rowHeight + (needCompliance ? complianceReserve : 0))
                    break;
                var isTotal = rowIndex == tableRows.Count - 1;
                DrawTableRowVariable(ops, tableRows[rowIndex], widths, pageHeight, margin, y, rowHeight, fontSize, header: isTotal);
                y += rowHeight;
                rowIndex++;
                rowsThisPage++;
            }

            if (rowsThisPage == 0 && rowIndex < tableRows.Count)
            {
                DrawTableRowVariable(ops, tableRows[rowIndex], widths, pageHeight, margin, y, rowHeight, fontSize, header: false);
                rowIndex++;
            }

            if (rowIndex >= tableRows.Count)
                DrawWh347Compliance(ops, model, pageWidth, pageHeight, margin, y + 10);

            pages.Add(new PageContent(ops.ToString(), pageWidth, pageHeight));
            if (rowIndex >= tableRows.Count)
                break;
        }

        return BuildDocument(pages, model.CompanyName, DateTime.UtcNow);
    }

    private static float DrawWh347Header(
        StringBuilder ops, Wh347PdfModel model, float pageWidth, float pageHeight, float margin, float y)
    {
        DrawText(ops, "U.S. Department of Labor", margin, pageHeight - y - 8, 6, bold: false);
        DrawText(ops, "PAYROLL", margin, pageHeight - y - 20, 12, bold: true);
        DrawText(ops, "(WH-347)", margin, pageHeight - y - 30, 7, bold: false);
        DrawText(ops, "Wage and Hour Division", pageWidth / 2 - 50, pageHeight - y - 12, 6, bold: false);
        DrawText(ops, $"Week Ending: {model.WeekEnding}", pageWidth / 2 - 50, pageHeight - y - 24, 8, bold: true);
        DrawText(ops, "OMB No.: 1235-0008", pageWidth - margin - 110, pageHeight - y - 10, 6, bold: false);
        DrawText(ops, "Exp.: 02/28/2026", pageWidth - margin - 110, pageHeight - y - 20, 6, bold: false);
        y += 36;
        DrawHLine(ops, margin, pageHeight - y, pageWidth - margin, 0.5f, 0f);
        y += 8;
        DrawText(ops, $"Contractor: {model.CompanyName}", margin, pageHeight - y - 8, 7, bold: false);
        if (!string.IsNullOrWhiteSpace(model.CompanyAddress))
            DrawText(ops, $"Address: {model.CompanyAddress}", margin, pageHeight - y - 18, 7, bold: false);
        DrawText(ops, $"Project: {model.ProjectName}", pageWidth / 2 - 40, pageHeight - y - 8, 7, bold: false);
        if (!string.IsNullOrWhiteSpace(model.ProjectLocation))
            DrawText(ops, $"Location: {model.ProjectLocation}", pageWidth / 2 - 40, pageHeight - y - 18, 7, bold: false);
        DrawText(ops, $"Contract #: {model.ContractNumber}", pageWidth - margin - 160, pageHeight - y - 8, 7, bold: false);
        DrawText(ops, $"Payroll #: {model.PayrollNumber}", pageWidth - margin - 160, pageHeight - y - 18, 7, bold: false);
        y += 28;
        DrawHLine(ops, margin, pageHeight - y, pageWidth - margin, 0.5f, 0.5f);
        y += 6;
        return y;
    }

    private static void DrawWh347Compliance(
        StringBuilder ops, Wh347PdfModel model, float pageWidth, float pageHeight, float margin, float y)
    {
        var start = model.PeriodStart?.ToString("d MMMM, yyyy", CultureInfo.InvariantCulture) ?? "___________, ______";
        var end = model.PeriodEnd?.ToString("d MMMM, yyyy", CultureInfo.InvariantCulture) ?? "___________, ______";
        DrawText(ops, "STATEMENT OF COMPLIANCE", margin, pageHeight - y - 8, 8, bold: true);
        y += 14;
        var paragraph =
            $"(1) That I pay or supervise the payment of the persons employed on the {model.ProjectName} " +
            $"during the payroll period commencing on {start} and ending {end}; that all persons employed on said " +
            $"project have been paid the full weekly wages earned, that no rebates have been or will be made " +
            $"either directly or indirectly to or on behalf of {model.CompanyName} from the full weekly wages earned " +
            "by any person and that no deductions have been made other than permissible deductions as defined in " +
            "Regulations, Part 3 (29 CFR Subtitle A), of the Secretary of Labor under the Copeland Act " +
            "(40 U.S.C. 3145).";
        foreach (var line in Wrap(paragraph, 150))
        {
            DrawText(ops, line, margin, pageHeight - y - 7, 6, bold: false);
            y += 8;
        }

        y += 6;
        DrawText(ops, "(2) That any payrolls otherwise under this contract required to be submitted for the above period are correct and complete.", margin, pageHeight - y - 7, 6, bold: false);
        y += 22;
        DrawHLine(ops, margin, pageHeight - y, margin + 180, 0.6f, 0f);
        DrawText(ops, "Signature", margin, pageHeight - y - 10, 6, bold: false);
        DrawHLine(ops, margin + 200, pageHeight - y, margin + 320, 0.6f, 0f);
        DrawText(ops, "Date", margin + 200, pageHeight - y - 10, 6, bold: false);
        DrawHLine(ops, margin + 340, pageHeight - y, pageWidth - margin, 0.6f, 0f);
        DrawText(ops, "Name and Title", margin + 340, pageHeight - y - 10, 6, bold: false);
    }

    private static void DrawLetterhead(
        StringBuilder ops, string companyName, string title, DateTime reportDate,
        float pageWidth, float pageHeight, float margin)
    {
        var top = pageHeight - margin - 10;
        DrawRect(ops, margin, top - 16, 40, 18, fillGray: 0.92f, stroke: true);
        DrawText(ops, "LOGO", margin + 8, top - 12, 7, bold: false);
        DrawText(ops, companyName, margin + 52, top - 2, 14, bold: true);
        DrawText(ops, title, margin + 52, top - 16, 11, bold: true);
        var dateLabel = $"Report Date: {reportDate:MM/dd/yyyy}";
        DrawText(ops, dateLabel, pageWidth - margin - ApproxWidth(dateLabel, 9), top - 4, 9, bold: false);
    }

    private static void DrawTableRow(
        StringBuilder ops, IReadOnlyList<string> cells, float pageHeight,
        float margin, float yFromTop, float colWidth, float rowHeight, float fontSize, bool header)
    {
        var pdfY = pageHeight - yFromTop - rowHeight;
        var gray = header ? 0.92f : (float?)null;
        for (var i = 0; i < cells.Count; i++)
        {
            var x = margin + i * colWidth;
            DrawRect(ops, x, pdfY, colWidth, rowHeight, fillGray: gray, stroke: true);
            var text = SingleLine(cells[i]);
            var maxChars = Math.Max(1, (int)(colWidth / (fontSize * 0.5f)) - 1);
            if (text.Length > maxChars)
                text = text[..Math.Max(0, maxChars - 1)] + "…";
            var textY = pdfY + 4;
            var alignRight = !header && i > 0;
            if (alignRight)
            {
                var tw = ApproxWidth(text, fontSize);
                DrawText(ops, text, x + colWidth - 4 - tw, textY, fontSize, bold: header);
            }
            else
            {
                DrawText(ops, text, x + 3, textY, fontSize, bold: header);
            }
        }
    }

    private static void DrawTableRowVariable(
        StringBuilder ops, IReadOnlyList<string> cells, float[] widths, float pageHeight,
        float margin, float yFromTop, float rowHeight, float fontSize, bool header)
    {
        var pdfY = pageHeight - yFromTop - rowHeight;
        var x = margin;
        var gray = header ? 0.92f : (float?)null;
        for (var i = 0; i < cells.Count && i < widths.Length; i++)
        {
            DrawRect(ops, x, pdfY, widths[i], rowHeight, fillGray: gray, stroke: true);
            var text = SingleLine(cells[i]);
            var maxChars = Math.Max(1, (int)(widths[i] / (fontSize * 0.5f)) - 1);
            if (text.Length > maxChars)
                text = text[..Math.Max(0, maxChars - 1)] + "…";
            DrawText(ops, text, x + 2, pdfY + 3, fontSize, bold: header);
            x += widths[i];
        }
    }

    private static void DrawText(StringBuilder ops, string text, float x, float y, float size, bool bold)
    {
        var font = bold ? "F2" : "F1";
        ops.Append("BT /").Append(font).Append(' ').Append(F(size)).Append(" Tf ")
            .Append(F(x)).Append(' ').Append(F(y)).Append(" Td (")
            .Append(PdfEscape(text)).Append(") Tj ET\n");
    }

    private static void DrawRect(StringBuilder ops, float x, float y, float w, float h, float? fillGray, bool stroke)
    {
        if (fillGray.HasValue)
        {
            ops.Append(F(fillGray.Value)).Append(' ').Append(F(fillGray.Value)).Append(' ').Append(F(fillGray.Value)).Append(" rg ");
            ops.Append(F(x)).Append(' ').Append(F(y)).Append(' ').Append(F(w)).Append(' ').Append(F(h)).Append(" re f\n");
            ops.Append("0 0 0 rg\n");
        }

        if (stroke)
        {
            ops.Append("0.6 0.6 0.6 RG 0.4 w ");
            ops.Append(F(x)).Append(' ').Append(F(y)).Append(' ').Append(F(w)).Append(' ').Append(F(h)).Append(" re S\n");
            ops.Append("0 0 0 RG\n");
        }
    }

    private static void DrawHLine(StringBuilder ops, float x1, float y, float x2, float width, float gray)
    {
        ops.Append(F(gray)).Append(' ').Append(F(gray)).Append(' ').Append(F(gray)).Append(" RG ");
        ops.Append(F(width)).Append(" w ");
        ops.Append(F(x1)).Append(' ').Append(F(y)).Append(" m ");
        ops.Append(F(x2)).Append(' ').Append(F(y)).Append(" l S\n");
        ops.Append("0 0 0 RG\n");
    }

    private static byte[] BuildDocument(List<PageContent> pages, string companyName, DateTime reportDate)
    {
        var bodies = new List<string> { "" }; // 1-based

        string Obj(string body)
        {
            bodies.Add(body);
            return (bodies.Count - 1).ToString(CultureInfo.InvariantCulture);
        }

        var font1 = Obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
        var font2 = Obj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");

        // Pre-allocate page and content object numbers
        var contentObjNums = new int[pages.Count];
        var pageObjNums = new int[pages.Count];
        for (var i = 0; i < pages.Count; i++)
        {
            bodies.Add(""); // content
            contentObjNums[i] = bodies.Count - 1;
            bodies.Add(""); // page
            pageObjNums[i] = bodies.Count - 1;
        }

        var pagesObjNum = bodies.Count; // will add next
        bodies.Add(""); // Pages
        var catalogObjNum = bodies.Count;
        bodies.Add(""); // Catalog

        var kids = string.Join(" ", pageObjNums.Select(n => $"{n} 0 R"));
        bodies[pagesObjNum] = $"<< /Type /Pages /Kids [{kids}] /Count {pages.Count} >>";
        bodies[catalogObjNum] = $"<< /Type /Catalog /Pages {pagesObjNum} 0 R >>";

        for (var i = 0; i < pages.Count; i++)
        {
            var footer = new StringBuilder();
            var label = $"{companyName}  •  Generated {reportDate:MM/dd/yyyy}  •  Page {i + 1} of {pages.Count}";
            DrawText(footer, label, 36, 16, 8, bold: false);
            var stream = pages[i].Operations + footer;
            var streamBytes = Encoding.ASCII.GetBytes(stream);
            bodies[contentObjNums[i]] = $"<< /Length {streamBytes.Length} >>\nstream\n{stream}endstream";
            bodies[pageObjNums[i]] =
                $"<< /Type /Page /Parent {pagesObjNum} 0 R /MediaBox [0 0 {F(pages[i].Width)} {F(pages[i].Height)}] " +
                $"/Resources << /Font << /F1 {font1} 0 R /F2 {font2} 0 R >> >> /Contents {contentObjNums[i]} 0 R >>";
        }

        using var ms = new MemoryStream();
        void Ascii(string s) => ms.Write(Encoding.ASCII.GetBytes(s));
        Ascii("%PDF-1.4\n%\x80\x80\x80\x80\n");
        var offsets = new long[bodies.Count];
        for (var i = 1; i < bodies.Count; i++)
        {
            offsets[i] = ms.Position;
            Ascii($"{i} 0 obj\n{bodies[i]}\nendobj\n");
        }

        var xref = ms.Position;
        Ascii($"xref\n0 {bodies.Count}\n");
        Ascii("0000000000 65535 f \n");
        for (var i = 1; i < bodies.Count; i++)
            Ascii($"{offsets[i]:D10} 00000 n \n");
        Ascii($"trailer\n<< /Size {bodies.Count} /Root {catalogObjNum} 0 R >>\nstartxref\n{xref}\n%%EOF\n");
        return ms.ToArray();
    }

    private static string PdfEscape(string text)
    {
        var sb = new StringBuilder(text.Length + 8);
        foreach (var ch in text)
        {
            if (ch is '(' or ')' or '\\')
            {
                sb.Append('\\').Append(ch);
            }
            else if (ch is >= (char)32 and <= (char)126)
            {
                sb.Append(ch);
            }
            else if (ch is '\n' or '\r' or '\t')
            {
                sb.Append(' ');
            }
            else if (ch <= 255)
            {
                sb.Append('\\').Append(((int)ch).ToString("000", CultureInfo.InvariantCulture));
            }
            else
            {
                sb.Append('?');
            }
        }

        return sb.ToString();
    }

    private static string F(float value) => value.ToString("0.###", CultureInfo.InvariantCulture);

    private static float ApproxWidth(string text, float fontSize) => text.Length * fontSize * 0.5f;

    private static string SingleLine(string? text) =>
        (text ?? string.Empty).Replace('\n', ' ').Replace('\r', ' ');

    private static string Money(decimal value) => value.ToString("C2", CultureInfo.CurrentCulture);

    private static string Hrs(decimal value) => value > 0 ? value.ToString("N1", CultureInfo.InvariantCulture) : "";

    private static IEnumerable<string> Wrap(string text, int maxChars)
    {
        if (string.IsNullOrEmpty(text))
            yield break;
        var words = text.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var line = new StringBuilder();
        foreach (var word in words)
        {
            if (line.Length + word.Length + 1 > maxChars && line.Length > 0)
            {
                yield return line.ToString();
                line.Clear();
            }

            if (line.Length > 0)
                line.Append(' ');
            line.Append(word);
        }

        if (line.Length > 0)
            yield return line.ToString();
    }

    private sealed record PageContent(string Operations, float Width, float Height);

    internal sealed record Wh347PdfModel(
        string CompanyName,
        string CompanyAddress,
        string ProjectName,
        string ProjectLocation,
        string ContractNumber,
        string PayrollNumber,
        string WeekEnding,
        DateOnly? PeriodStart,
        DateOnly? PeriodEnd,
        IReadOnlyList<Wh347PdfRow> Rows);

    internal sealed record Wh347PdfRow(
        string EmployeeName,
        string EmployeeNumber,
        string Classification,
        decimal StraightTimeHours,
        decimal OvertimeHours,
        decimal Rate,
        decimal GrossPay,
        decimal Fica,
        decimal Withholding,
        decimal OtherDeductions,
        decimal NetPay,
        decimal MonHours,
        decimal TueHours,
        decimal WedHours,
        decimal ThuHours,
        decimal FriHours,
        decimal SatHours,
        decimal SunHours);
}

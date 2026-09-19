"use client";

/**
 * The résumé page carries a print stylesheet, so the browser's own print
 * dialogue is what produces the PDF. One button, no library, no second copy of
 * the facts to keep in step.
 */
export default function PrintButton() {
  return (
    <button
      type="button"
      className="resume__print"
      onClick={() => window.print()}
      data-cursor="link"
    >
      Print or save as PDF
    </button>
  );
}

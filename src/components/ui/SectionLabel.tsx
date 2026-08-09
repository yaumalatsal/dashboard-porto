type SectionLabelProps = {
  label: string;
  number: string;
  light?: boolean;
};

export default function SectionLabel({ label, number, light = false }: SectionLabelProps) {
  return (
    <div
      className={`section-label${light ? " section-label--light" : ""}`}
      aria-label={`Section ${number}: ${label}`}
      data-parallax
      data-parallax-speed="-0.07"
      data-instrument-trace
    >
      <span className="section-label__dial" aria-hidden="true"><i /><b>{number}</b></span>
      <span className="section-label__rule" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

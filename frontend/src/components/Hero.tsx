"use client";

import { useI18n } from "@/lib/i18n";
import { CONTRACT_ADDRESS, EXPLORER, monad } from "@/lib/config";

export function HeroCopy() {
  const { t } = useI18n();
  return (
    <section className="hero">
      <span className="eyebrow">{t.eyebrow}</span>
      <h1>
        {t.heroLines.map((line) => (
          <span key={line}>
            {line}
            <br />
          </span>
        ))}
        <span className="accent">{t.heroL3}</span>
      </h1>
      <p>
        {t.heroP1}
        <span className="ok">{t.right}</span>
        {t.or}
        <span className="error">{t.wrong}</span>
        {t.heroP2}
      </p>
      <div className="hero-cta">
        <a className="btn primary" href="#rounds">{t.ctaBet}</a>
        <a className="btn ghost" href="/how">{t.ctaHow}</a>
      </div>
      <ul className="hero-points">
        <li><b>20</b> {t.pt1}</li>
        <li><b>{t.min15}</b> {t.pt2}</li>
        <li><b>0</b> {t.pt3}</li>
      </ul>
    </section>
  );
}

export function HomeFooter() {
  const { t } = useI18n();
  return (
    <footer className="small muted">
      {t.contract}{" "}
      <a className="mono" href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
        {CONTRACT_ADDRESS}
      </a>{" "}
      {t.footer(monad.name)}
    </footer>
  );
}

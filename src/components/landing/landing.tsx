import Link from "next/link";
import Image from "next/image";
import { DirectorySearch } from "./directory-search";
import { copy, locales, type Locale } from "./copy";
function Icon({
  name,
  className = "",
}: {
  name:
    | "plus"
    | "arrow"
    | "check"
    | "leaf"
    | "pill"
    | "calendar"
    | "bell"
    | "shield"
    | "sun";
  className?: string;
}) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    leaf: (
      <>
        <path d="M20 3C9 2 3 7 4 14s12 10 15-1c1-3 1-6 1-10Z" />
        <path d="M4 21 16 8" />
      </>
    ),
    pill: (
      <>
        <rect
          x="3"
          y="7"
          width="18"
          height="10"
          rx="5"
          transform="rotate(-45 12 12)"
        />
        <path d="m8.5 8.5 7 7" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5" width="16" height="16" rx="3" />
        <path d="M8 3v4m8-4v4M4 11h16m-12 5h3" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-9 12h6" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
  };
  return (
    <svg
      className={className}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
function Brand({ locale }: { locale: Locale }) {
  return (
    <Link
      className="lp-brand"
      href={`/${locale}`}
      aria-label={copy[locale].brand}
    >
      <span className="lp-mark">
        <Image
          src="/icon-family.png"
          alt=""
          width={43}
          height={43}
          sizes="43px"
        />
      </span>
      <span>
        {copy[locale].brand}
        <small>{copy[locale].tagline}</small>
      </span>
    </Link>
  );
}
export default function Landing({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const names = { en: "English", ar: "العربية", fr: "Français" };
  return (
    <div className="landing">
      <Link href="#main" className="lp-skip">
        {t.skip}
      </Link>
      <div className="lp-topline" aria-hidden="true" />
      <header className="lp-header lp-wrap">
        <Brand locale={locale} />
        <nav className="lp-nav" aria-label={t.nav[0]}>
          {t.nav.map((label, i) => (
            <Link key={label} href={`#${["why", "how", "questions"][i]}`}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="lp-header-actions">
          <nav className="lp-languages" aria-label={t.language}>
            {locales.map((l) => (
              <Link
                key={l}
                href={`/${l}`}
                lang={l}
                hrefLang={l}
                aria-label={names[l]}
                aria-current={locale === l ? "page" : undefined}
              >
                {l === "ar" ? "ع" : l.toUpperCase()}
              </Link>
            ))}
          </nav>
          <Link href="/portal" className="lp-login">
            {t.login}
            <Icon name="arrow" className="lp-arrow" />
          </Link>
        </div>
      </header>
      <main id="main">
        <section className="lp-hero lp-wrap">
          <div className="lp-hero-copy">
            <p className="lp-eyebrow">
              <span />
              {t.eyebrow}
            </p>
            <h1>
              {t.title}
              <em>{t.accent}</em>
            </h1>
            <p className="lp-description">{t.description}</p>
            <div className="lp-hero-actions">
              <Link className="lp-button" href="/portal">
                {t.cta}
                <Icon name="arrow" className="lp-arrow" />
              </Link>
              <Link className="lp-text-link" href="#why">
                {t.explore}
                <span aria-hidden="true">↘</span>
              </Link>
            </div>
            <div className="lp-reassurance">
              {t.reassurance.map((text) => (
                <span key={text}>
                  <Icon name="check" />
                  {text}
                </span>
              ))}
            </div>
          </div>
          <div className="lp-visual" aria-label={t.preview}>
            <div className="lp-orbit lp-orbit-one" />
            <div className="lp-orbit lp-orbit-two" />
            <span className="lp-spark lp-spark-one" aria-hidden="true">
              ✳
            </span>
            <span className="lp-spark lp-spark-two" aria-hidden="true">
              ✧
            </span>
            <div className="lp-floating-leaf" aria-hidden="true">
              <Icon name="leaf" />
            </div>
            <div className="lp-product">
              <div className="lp-product-top">
                <span className="lp-mini-mark">
                  <Image
                    src="/icon-family.png"
                    alt=""
                    width={22}
                    height={22}
                    sizes="22px"
                  />
                </span>
                <span>{t.brand}</span>
                <Icon name="bell" />
              </div>
              <div className="lp-product-body">
                <p className="lp-product-greeting">
                  <Icon name="sun" />
                  {t.previewHello}
                </p>
                <h2>{t.previewTitle}</h2>
                <div className="lp-preview-tabs">
                  <span>{t.previewTabs[0]}</span>
                  <span>{t.previewTabs[1]}</span>
                </div>
                <div className="lp-product-banner">
                  <Icon name="leaf" />
                  <span>{t.previewStock}</span>
                </div>
                {t.previewMedicine.map((medicine, i) => (
                  <div className="lp-medicine" key={medicine}>
                    <span className={`lp-medicine-icon lp-medicine-icon-${i}`}>
                      <Icon name="pill" />
                    </span>
                    <div>
                      <strong>{medicine}</strong>
                      <small>
                        <span />
                        {t.previewStatus}
                      </small>
                    </div>
                    <Icon name="check" />
                  </div>
                ))}
                <div className="lp-preview-routine">
                  <span>
                    <Icon name="calendar" />
                  </span>
                  <div>
                    <strong>{t.previewRoutine}</strong>
                    <p>{t.previewNote}</p>
                  </div>
                </div>
              </div>
              <div className="lp-product-bottom">
                <i />
                <i />
                <span>
                  <Icon name="plus" />
                </span>
                <i />
                <i />
              </div>
            </div>
            <div className="lp-floating-note">
              <span>
                <Icon name="check" />
              </span>
              <div>
                <strong>{t.floatingTitle}</strong>
                <small>{t.floatingText}</small>
              </div>
            </div>
            <p className="lp-preview-caption">{t.preview}</p>
          </div>
        </section>
        <section
          id="directory"
          className="lp-directory lp-wrap"
          aria-labelledby="directory-title"
        >
          <div className="lp-directory-icon">
            <Icon name="pill" />
          </div>
          <div className="lp-directory-copy">
            <h2 id="directory-title">{t.directory.title}</h2>
            <p>{t.directory.description}</p>
            <form
              action="/portal"
              method="get"
              role="search"
              aria-label={t.directory.button}
            >
              <div className="lp-directory-input">
                <DirectorySearch label={t.directory.label} />
                <button className="lp-button" type="submit">
                  {t.directory.button}
                  <Icon name="arrow" className="lp-arrow" />
                </button>
              </div>
              <p id="directory-note" className="lp-directory-note">
                {t.directory.note}
              </p>
            </form>
          </div>
        </section>
        <section id="why" className="lp-features">
          <div className="lp-wrap">
            <div className="lp-section-heading">
              <p className="lp-eyebrow">{t.brand}</p>
              <h2>
                {t.promise}
                <br />
                <em>{t.promiseAccent}</em>
              </h2>
              <p>{t.promiseText}</p>
            </div>
            <div className="lp-feature-grid">
              {t.features.map((feature, i) => (
                <article
                  className={`lp-feature lp-feature-${i}`}
                  key={feature.tag}
                >
                  <div className="lp-feature-art" aria-hidden="true">
                    {i === 0 ? (
                      <>
                        <span className="lp-art-box">
                          <Icon name="plus" />
                          <i />
                        </span>
                        <span className="lp-art-bottle">
                          <Icon name="leaf" />
                        </span>
                        <span className="lp-art-pill" />
                      </>
                    ) : i === 1 ? (
                      <div className="lp-art-calendar">
                        <div>
                          <i />
                          <i />
                        </div>
                        <span>
                          {Array.from({ length: 12 }, (_, n) => (
                            <i key={n} className={n === 6 ? "selected" : ""}>
                              {n === 6 ? <Icon name="check" /> : ""}
                            </i>
                          ))}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="lp-art-bell">
                          <Icon name="bell" />
                          <i />
                        </div>
                        <span className="lp-art-message">
                          <i />
                          <i />
                          <Icon name="check" />
                        </span>
                      </>
                    )}
                  </div>
                  <p className="lp-eyebrow">{feature.tag}</p>
                  <h3>{feature.title}</h3>
                  <p>{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section id="how" className="lp-how lp-wrap">
          <div className="lp-how-intro">
            <p className="lp-eyebrow">{t.stepsEyebrow}</p>
            <h2>{t.stepsTitle}</h2>
            <p>{t.stepsText}</p>
            <span className="lp-drawn-leaf" aria-hidden="true">
              <Icon name="leaf" />
            </span>
          </div>
          <ol className="lp-steps">
            {t.steps.map((step, i) => (
              <li key={step.title}>
                <span className="lp-step-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3>{step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="lp-privacy lp-wrap">
          <div className="lp-privacy-icon" aria-hidden="true">
            <Icon name="shield" />
            <span />
            <span />
          </div>
          <div>
            <p className="lp-eyebrow">{t.privacyEyebrow}</p>
            <h2>{t.privacyTitle}</h2>
            <p>{t.privacyBody}</p>
            <ul>
              {t.privacyPoints.map((point) => (
                <li key={point}>
                  <Icon name="check" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section id="questions" className="lp-faq lp-wrap">
          <div>
            <p className="lp-eyebrow">{t.faqEyebrow}</p>
            <h2>{t.faqTitle}</h2>
          </div>
          <div className="lp-faq-list">
            {t.faqs.map((faq) => (
              <details key={faq.question}>
                <summary>
                  {faq.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="lp-final">
          <div className="lp-wrap">
            <span className="lp-final-symbol" aria-hidden="true">
              <Icon name="leaf" />
            </span>
            <h2>{t.finalTitle}</h2>
            <p>{t.finalText}</p>
            <Link className="lp-button" href="/portal">
              {t.cta}
              <Icon name="arrow" className="lp-arrow" />
            </Link>
            <small>{t.footerNote}</small>
          </div>
        </section>
      </main>
      <footer className="lp-footer lp-wrap">
        <Brand locale={locale} />
        <p>{t.footer}</p>
        <Link
          href="#main"
          className="lp-back-top"
          aria-label={
            locale === "ar"
              ? "العودة إلى الأعلى"
              : locale === "fr"
                ? "Retour en haut"
                : "Back to top"
          }
        >
          ↑
        </Link>
      </footer>
    </div>
  );
}

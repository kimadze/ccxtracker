import Image from "next/image";
import styles from "./dashboard-hero.module.css";

export function DashboardHero() {
  return (
    <section className={styles.hero} aria-labelledby="portfolio-hero-title">
      <div className={styles.landscape} aria-hidden="true">
        <Image
          src="/ccx-mountain-hero.png"
          alt=""
          fill
          priority
          sizes="(max-width: 700px) 100vw, 65vw"
        />
      </div>
      <div className={styles.copy}>
        <h1 id="portfolio-hero-title">
          Track. <span>Analyze.</span> <strong>Grow.</strong>
        </h1>
        <p>Your simple crypto portfolio tracker</p>
      </div>
      <div className={styles.signature}>
        <p>
          One Portfolio<span>A Bigger Tomorrow</span>
        </p>
        <svg className={styles.mark} viewBox="0 0 120 88" aria-hidden="true">
          <defs>
            <linearGradient id="hero-x" x1="0" y1="0" x2="1" y2="1">
              <stop stopColor="#b695ff" />
              <stop offset=".45" stopColor="#6758f5" />
              <stop offset="1" stopColor="#262858" />
            </linearGradient>
          </defs>
          <path
            d="M0 0h31l29 29L89 0h31L76 44l44 44H89L60 59 31 88H0l44-44Z"
            fill="url(#hero-x)"
          />
        </svg>
      </div>
      <p className={styles.discipline}>
        Discipline today<span>Compounds tomorrow</span>
      </p>
    </section>
  );
}

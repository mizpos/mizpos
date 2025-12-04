import { css } from "../../styled-system/css";
import { Footer, Header } from "../components/layout";
import {
  ArchitectureSection,
  FeaturesSection,
  GettingStartedSection,
  HeroSection,
  ScreenshotsSection,
} from "../components/sections";

export function HomePage() {
  return (
    <div
      className={css({
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      })}
    >
      <Header />
      <main className={css({ flex: 1 })}>
        <HeroSection />
        <FeaturesSection />
        <ScreenshotsSection />
        <ArchitectureSection />
        <GettingStartedSection />
      </main>
      <Footer />
    </div>
  );
}

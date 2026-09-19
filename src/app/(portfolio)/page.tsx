import AstrolabeNavigator from "@/components/ui/AstrolabeNavigator";
import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import ProjectsSection from "@/components/sections/ProjectsSection";
import SkillsSection from "@/components/sections/SkillsSection";
import OperationsSection from "@/components/sections/OperationsSection";
import ExperienceSection from "@/components/sections/ExperienceSection";
import CredentialsSection from "@/components/sections/CredentialsSection";
import ContactSection from "@/components/sections/ContactSection";
import ScrollSectionTracker from "@/components/ui/ScrollSectionTracker";
import InstrumentSpine from "@/components/ui/InstrumentSpine";
import { heroReadout } from "@/lib/monitor/hero";

/**
 * The Live Systems section reads real monitoring data, so the page cannot be
 * fully static — but it should not be per-request either. Incremental
 * regeneration keeps the HTML cached and served instantly while the status is
 * never more than a minute old, which is the right trade for a portfolio whose
 * first job is to load fast.
 */
export const revalidate = 60;

export default function Home() {
  return (
    <AstrolabeNavigator>
      <ScrollSectionTracker />
      <InstrumentSpine />
      <HeroSection readout={heroReadout()} />
      <AboutSection />
      <ProjectsSection />
      <SkillsSection />
      <OperationsSection />
      <ExperienceSection />
      <CredentialsSection />
      <ContactSection />
    </AstrolabeNavigator>
  );
}

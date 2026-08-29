import AstrolabeNavigator from "@/components/ui/AstrolabeNavigator";
import HeroSection from "@/components/sections/HeroSection";
import AboutSection from "@/components/sections/AboutSection";
import ProjectsSection from "@/components/sections/ProjectsSection";
import SkillsSection from "@/components/sections/SkillsSection";
import ExperienceSection from "@/components/sections/ExperienceSection";
import ContactSection from "@/components/sections/ContactSection";
import ScrollSectionTracker from "@/components/ui/ScrollSectionTracker";

export default function Home() {
  return (
    <AstrolabeNavigator>
      <ScrollSectionTracker />
      <HeroSection />
      <AboutSection />
      <ProjectsSection />
      <SkillsSection />
      <ExperienceSection />
      <ContactSection />
    </AstrolabeNavigator>
  );
}

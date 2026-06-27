import { Nav } from "@/components/Nav";
import { Hero } from "@/components/Hero";
import { Manifesto } from "@/components/Manifesto";
import { Recognition } from "@/components/Recognition";
import { HowItWorks } from "@/components/HowItWorks";
import { Clarity } from "@/components/Clarity";
import { FocusSets } from "@/components/FocusSets";
import { AvoidedTasks } from "@/components/AvoidedTasks";
import { Personalization } from "@/components/Personalization";
import { XPProgress } from "@/components/XPProgress";
import { Pricing } from "@/components/Pricing";
import { FinalCTA } from "@/components/FinalCTA";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Manifesto />
        <Recognition />
        <HowItWorks />
        <Clarity />
        <FocusSets />
        <AvoidedTasks />
        <Personalization />
        <XPProgress />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  );
}

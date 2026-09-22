import { LimitationsLab } from '@/components/lab/limitations-lab';
import { StepPage } from '@/components/shell/step-page';

export default function Page() {
  return (
    <StepPage
      slug="limitations"
      lab={<LimitationsLab />}
      // Staged: each stage opens the concept it introduces (components/lab/stage-rail.tsx).
    >
      <p>Everything that bites, in one place. The lab walks the six sections in order.</p>
    </StepPage>
  );
}

import TemplateRoundOnlyLibrary from './TemplateRoundOnlyLibrary';
import type { TemplateLibraryContext } from '../../../lib/templates/workspace/template-library-service';

export default function TemplateLibraryHub({ context }: { context: TemplateLibraryContext }) {
  return <section className="template-workspace-hub template-library-minimal-hub" data-template-workspace-hub="library" data-template-process="template-source-of-truth" data-template-library-ui="round-only">
    <TemplateRoundOnlyLibrary />
  </section>;
}

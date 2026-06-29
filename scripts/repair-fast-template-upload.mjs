#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

const file = 'components/TemplatePacketConfigurator.tsx';
let source = readFileSync(file, 'utf8');

const before = `  async function uploadExhibit(kind: ExhibitKind, file: File) {
    try {
      const syncMessage = await syncExhibitToSupabase(kind, file);
      const next = await saveTemplateExhibit(round, kind, file);

      setExhibits(next);
      onExhibitsChange(next);

      const contract = next[kind]?.contract;
      onMessage(\`${'${syncMessage}'}${'${contract?.mode === \'PLACEHOLDERS\' ? ` ${contract.tags.length} placeholder tag(s) mapped to Source Data.` : contract?.mode === \'LEGACY_HIGHLIGHTED\' ? \' Highlighted fields will be mapped from Source Data.\' : \'\''}\`);
      setActiveNode(null);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'File could not be saved.');
    }
  }`;

const after = `  async function uploadExhibit(kind: ExhibitKind, file: File) {
    try {
      const next = await saveTemplateExhibit(round, kind, file);

      setExhibits(next);
      onExhibitsChange(next);
      setActiveNode(null);

      const contract = next[kind]?.contract;
      onMessage(\`${'${exhibitTitles[kind]}'} saved locally. Cloud sync is running in the background.${'${contract?.mode === \'PLACEHOLDERS\' ? ` ${contract.tags.length} placeholder tag(s) mapped to Source Data.` : contract?.mode === \'LEGACY_HIGHLIGHTED\' ? \' Highlighted fields will be mapped from Source Data.\' : \'\''}\`);

      void syncExhibitToSupabase(kind, file)
        .then((syncMessage) => onMessage(syncMessage))
        .catch((error) => onMessage(error instanceof Error ? \`Local save succeeded, but cloud sync failed: ${'${error.message}'}\` : 'Local save succeeded, but cloud sync failed.'));
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'File could not be saved.');
    }
  }`;

if (!source.includes(before)) {
  console.log('Fast template upload repair not needed or uploadExhibit has already changed.');
  process.exit(0);
}

source = source.replace(before, after);
writeFileSync(file, source);
console.log('Repaired template upload to update UI before cloud sync.');

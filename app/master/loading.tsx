import ConsoleInstantLoading from '../../components/console/ConsoleInstantLoading';

export default function MasterLoading() {
  return <ConsoleInstantLoading role="master" title="Master console." description="Loading the master shell immediately while governance metrics and account datasets stream in." datasetLabel="Master dashboard" />;
}

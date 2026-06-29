import ConsoleInstantLoading from '../../components/console/ConsoleInstantLoading';

export default function AdminLoading() {
  return <ConsoleInstantLoading role="manager" title="Client access center." description="Loading the manager shell immediately while client metrics and datasets stream in." datasetLabel="Manager dashboard" />;
}

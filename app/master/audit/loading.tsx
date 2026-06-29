import ConsoleInstantLoading from '../../../components/console/ConsoleInstantLoading';

export default function Loading() {
  return <ConsoleInstantLoading role="master" title="Master audit log." description="Showing the master audit shell now while platform access events load." datasetLabel="Master audit events" />;
}

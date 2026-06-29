import ConsoleInstantLoading from '../../../components/console/ConsoleInstantLoading';

export default function Loading() {
  return <ConsoleInstantLoading role="manager" title="Manager audit log." description="Showing the manager audit shell now while access events load." datasetLabel="Manager audit events" />;
}

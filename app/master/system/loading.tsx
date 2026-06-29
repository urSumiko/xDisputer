import ConsoleInstantLoading from '../../../components/console/ConsoleInstantLoading';

export default function Loading() {
  return <ConsoleInstantLoading role="master" title="Health overview." description="Showing the master health shell now while observability records load." datasetLabel="Health records" />;
}

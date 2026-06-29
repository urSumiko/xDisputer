import ConsoleInstantLoading from '../../../components/console/ConsoleInstantLoading';

export default function Loading() {
  return <ConsoleInstantLoading role="manager" title="Client exception queue." description="Showing the manager exception shell now while blocked and suspended account records load." datasetLabel="Exception queue" />;
}

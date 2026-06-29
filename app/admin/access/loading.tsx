import ConsoleInstantLoading from '../../../components/console/ConsoleInstantLoading';

export default function AdminAccessLoading() {
  return <ConsoleInstantLoading role="manager" title="Workspace client directory." description="Showing the manager access shell now while the paginated client dataset loads." datasetLabel="Client access dataset" />;
}

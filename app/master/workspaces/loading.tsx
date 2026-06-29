import ConsoleInstantLoading from '../../../components/console/ConsoleInstantLoading';

export default function MasterWorkspacesLoading() {
  return <ConsoleInstantLoading role="master" title="Workspace governance." description="Showing the master workspace shell now while governance records load." datasetLabel="Workspace dataset" />;
}

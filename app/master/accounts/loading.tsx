import ConsoleInstantLoading from '../../../components/console/ConsoleInstantLoading';

export default function MasterAccountsLoading() {
  return <ConsoleInstantLoading role="master" title="Workspace account directory." description="Showing the master account shell now while account filters, rows, and pagination load." datasetLabel="Master account dataset" />;
}

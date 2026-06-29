import { jsonFromServiceResult } from '../../../../src/server/http/api-response';
import { readModernizationStatus } from '../../../../src/server/services/modernization-status';

export const dynamic = 'force-dynamic';

export function GET() {
  return jsonFromServiceResult(readModernizationStatus());
}

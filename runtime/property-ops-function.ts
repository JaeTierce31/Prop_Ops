import { handlePropertyOpsApi } from '../src/server/property-ops-api';

export default {
  async fetch(request: Request, env: unknown) {
    const response = await handlePropertyOpsApi(request, env);
    if (response) return response;
    return new Response(JSON.stringify({ ok: false, error: 'NOT_FOUND' }), {
      status: 404,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  },
};

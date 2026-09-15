export { Room } from './room.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/room/')) {
      const code = url.pathname.slice('/api/room/'.length).split('/')[0];
      if (!code) return new Response('Missing room code', { status: 400 });
      const stub = env.ROOM.getByName(code);
      return stub.fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // redirect www and bip-110.com → bip110.org
    if (url.hostname !== "bip110.org") {
      return Response.redirect(`https://bip110.org${url.pathname}${url.search}`, 301);
    }

    // serve static assets
    return env.ASSETS.fetch(request);
  },
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const redirectUrl = `https://bip110.org${url.pathname}${url.search}`;
    return Response.redirect(redirectUrl, 301);
  }
}
